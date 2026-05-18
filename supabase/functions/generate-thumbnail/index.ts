// EP Cloud — generate-thumbnail Edge Function
// ===========================================
// Generates a thumbnail for an uploaded media row and records the
// extracted dimensions on the row. Designed to be called by the EP
// Cloud frontend immediately after a successful upload (with the
// user's session JWT) or, in the future, by a Storage webhook on
// bucket `media` INSERT (skips JWT auth — the webhook signature is
// verified instead).
//
// Runtime constraint
// ------------------
// The supabase/edge-runtime user-worker isolate **forbids subprocess
// spawning** (`Deno.Command` throws "Spawning subprocesses is not
// allowed"). That rules out shelling out to ffmpeg / imagemagick /
// sharp's native add-ons. The pipeline below is therefore pure JS
// using `imagescript` (PNG/JPEG/TIFF/GIF decode, JPEG/PNG encode).
//
// Pipeline:
//   1. Verify caller (user JWT or Storage webhook signature).
//   2. Load `public.media` row by id; assert ownership when called by
//      a user.
//   3. Mark row status = 'processing'.
//   4. Image kinds (PNG/JPEG/TIFF/GIF):
//         decode → resize so long edge ≤ 1280 (no upscale) → encode
//         JPEG @ q78 → upload as `<owner>/<id>.jpg`.
//      Image kinds we cannot decode (WebP, AVIF, HEIC/HEIF) and all
//      videos:
//         skip thumbnail; write status='ready' with thumbnail_path=null.
//      Other kinds (audio, pdf, …):
//         same — status='ready', no thumbnail.
//   5. Upload thumbnail to `thumbnails` bucket.
//   6. Update row: thumbnail_path, width, height, status='ready'.
//   7. On any failure, status='failed' and respond 500.
//
// Required env (auto-injected by edge-runtime):
//   SUPABASE_URL                — internal kong url (http://kong:8000)
//   SUPABASE_SERVICE_ROLE_KEY   — service role key
//
// Optional env:
//   GENERATE_THUMBNAIL_WEBHOOK_SECRET — when set, requests carrying
//     `x-storage-webhook-secret: <value>` skip JWT validation.

import { createClient } from "@supabase/supabase-js"
import { GIF, Image } from "imagescript"
import { z } from "zod"

// ----- config -------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const WEBHOOK_SECRET =
  Deno.env.get("GENERATE_THUMBNAIL_WEBHOOK_SECRET") ?? ""

// CORS allowlist. TODO: append the production frontend domain when known.
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "https://supabase.enclaveprojects.dev",
])

const THUMB_BUCKET = "thumbnails"
const SOURCE_BUCKET = "media"
const THUMB_LONG_EDGE = 1280
const THUMB_QUALITY = 78
const THUMB_EXT = "jpg"
const THUMB_CONTENT_TYPE = "image/jpeg"

// MIMEs imagescript can decode in this version.
const DECODABLE_IMAGE_MIMES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/tiff",
  "image/gif",
])

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "generate-thumbnail: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  )
}

// Service-role client. Bypasses RLS; only ever invoked after we've
// checked ownership ourselves.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ----- helpers ------------------------------------------------------------

const STRICT_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : ""
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, x-storage-webhook-secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...STRICT_HEADERS, ...corsHeaders(origin) },
  })
}

const inputSchema = z.object({
  media_id: z.string().uuid(),
})

type Caller =
  | { kind: "user"; userId: string }
  | { kind: "webhook" }
  | { kind: "anonymous" }

/**
 * Identify the caller without throwing. Order:
 *   1. Storage webhook secret (header `x-storage-webhook-secret`)
 *   2. Authorization: Bearer <user JWT>
 *   3. Anonymous → caller = anonymous, route returns 401.
 */
async function identifyCaller(req: Request): Promise<Caller> {
  const wh = req.headers.get("x-storage-webhook-secret")
  if (WEBHOOK_SECRET && wh && wh === WEBHOOK_SECRET) {
    return { kind: "webhook" }
  }

  const auth = req.headers.get("authorization") ?? ""
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return { kind: "anonymous" }
  const jwt = m[1].trim()

  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data?.user) return { kind: "anonymous" }
  return { kind: "user", userId: data.user.id }
}

function classifyKind(mime: string): "image" | "video" | "other" {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  return "other"
}

async function downloadOriginal(path: string): Promise<Uint8Array> {
  const { data, error } = await admin.storage
    .from(SOURCE_BUCKET)
    .download(path)
  if (error || !data) {
    throw new Error(
      `download(${path}) failed: ${error?.message ?? "no data"}`
    )
  }
  const buf = await data.arrayBuffer()
  return new Uint8Array(buf)
}

async function uploadThumbnail(
  path: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  const { error } = await admin.storage
    .from(THUMB_BUCKET)
    .upload(path, bytes, {
      upsert: true,
      contentType,
      cacheControl: "31536000, immutable",
    })
  if (error) throw new Error(`upload(${path}): ${error.message}`)
}

// ----- image pipeline (pure JS) -------------------------------------------

interface ImageOutcome {
  thumbnail: Uint8Array
  contentType: string
  width: number
  height: number
}

/**
 * Decode an image by MIME. Returns `null` for formats imagescript can't
 * handle (WebP/AVIF/HEIC/HEIF) so the caller can skip thumbnail
 * generation gracefully.
 *
 * NOTE: imagescript does not honour EXIF orientation. Most browser
 * uploads have orientation already baked into the pixels, but some
 * camera-direct images may show up rotated. Documented in README;
 * revisit later if it becomes a real issue.
 */
async function decodeImageByMime(
  mime: string,
  bytes: Uint8Array
): Promise<Image | null> {
  if (!DECODABLE_IMAGE_MIMES.has(mime)) return null

  if (mime === "image/gif") {
    // GIF.decode supports an "only first frame" shortcut which avoids
    // unpacking the whole animation. Frame extends Image, so we can
    // resize/encode it like any other Image.
    const frames = await GIF.decode(bytes, /*onlyExtractFirstFrame*/ true)
    const first = frames?.[0]
    return (first as unknown as Image) ?? null
  }

  // PNG / JPEG / TIFF — autodetected by Image.decode.
  return await Image.decode(bytes)
}

/**
 * Compute target dimensions: long edge ≤ THUMB_LONG_EDGE, never upscale.
 */
function targetDims(
  srcW: number,
  srcH: number
): { width: number; height: number; resize: boolean } {
  const longEdge = Math.max(srcW, srcH)
  if (longEdge <= THUMB_LONG_EDGE) {
    return { width: srcW, height: srcH, resize: false }
  }
  const scale = THUMB_LONG_EDGE / longEdge
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
    resize: true,
  }
}

async function processImage(
  src: Uint8Array,
  mime: string
): Promise<ImageOutcome | null> {
  const decoded = await decodeImageByMime(mime, src)
  if (!decoded) return null

  const { width: srcW, height: srcH } = decoded
  if (!srcW || !srcH) {
    throw new Error(`invalid image dimensions: ${srcW}x${srcH}`)
  }

  const dims = targetDims(srcW, srcH)
  const resized = dims.resize
    ? decoded.resize(dims.width, dims.height)
    : decoded

  // imagescript v1.3.0 has no WebP encoder. JPEG @ q78 is the closest
  // equivalent for thumbnail size/quality and is universally decodable.
  const encoded = await resized.encodeJPEG(THUMB_QUALITY)

  return {
    thumbnail: encoded,
    contentType: THUMB_CONTENT_TYPE,
    width: srcW,
    height: srcH,
  }
}

// ----- main handler -------------------------------------------------------

interface MediaRow {
  id: string
  owner_id: string
  storage_path: string
  mime_type: string
  status: string
}

async function loadMedia(mediaId: string): Promise<MediaRow | null> {
  const { data, error } = await admin
    .from("media")
    .select("id, owner_id, storage_path, mime_type, status")
    .eq("id", mediaId)
    .maybeSingle<MediaRow>()
  if (error) throw new Error(`media lookup failed: ${error.message}`)
  return data ?? null
}

async function setStatus(
  mediaId: string,
  status: "processing" | "ready" | "failed",
  patch: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await admin
    .from("media")
    .update({ status, ...patch })
    .eq("id", mediaId)
  if (error) {
    console.error("generate-thumbnail: status update failed", error)
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin)
  }

  // 1. Parse + validate body — never log the body.
  let mediaId: string
  try {
    const body = await req.json()
    const parsed = inputSchema.parse(body)
    mediaId = parsed.media_id
  } catch (_err) {
    return jsonResponse({ error: "invalid_body" }, 400, origin)
  }

  // 2. Identify caller.
  const caller = await identifyCaller(req)
  if (caller.kind === "anonymous") {
    return jsonResponse({ error: "unauthorized" }, 401, origin)
  }

  // 3. Load media row.
  let row: MediaRow | null
  try {
    row = await loadMedia(mediaId)
  } catch (err) {
    console.error("generate-thumbnail: load failed", err)
    return jsonResponse({ error: "internal_error" }, 500, origin)
  }
  if (!row) {
    return jsonResponse({ error: "not_found" }, 404, origin)
  }

  // 4. Authorization: a user must own the media. Webhooks bypass this.
  if (caller.kind === "user" && caller.userId !== row.owner_id) {
    return jsonResponse({ error: "forbidden" }, 403, origin)
  }

  // 5. Idempotency: if we've already finished, no-op success.
  if (row.status === "ready") {
    return jsonResponse({ ok: true, idempotent: true }, 200, origin)
  }

  await setStatus(mediaId, "processing")

  try {
    const kind = classifyKind(row.mime_type)
    const thumbPath = `${row.owner_id}/${row.id}.${THUMB_EXT}`
    let patch: Record<string, unknown> = {}

    if (kind === "image") {
      // Download only when we know we'll use the bytes. Skipped formats
      // (WebP/AVIF/HEIC) avoid the extra storage round-trip.
      if (DECODABLE_IMAGE_MIMES.has(row.mime_type)) {
        const src = await downloadOriginal(row.storage_path)
        const out = await processImage(src, row.mime_type)
        if (out) {
          await uploadThumbnail(thumbPath, out.thumbnail, out.contentType)
          patch = {
            thumbnail_path: thumbPath,
            width: out.width,
            height: out.height,
          }
        } else {
          // Defensive — shouldn't happen, decodeImageByMime returns
          // non-null for every entry in DECODABLE_IMAGE_MIMES.
          patch = { thumbnail_path: null }
        }
      } else {
        // WebP / AVIF / HEIC / HEIF — imagescript can't decode these.
        // Frontend already shows a placeholder for null thumbnails.
        patch = { thumbnail_path: null }
      }
    } else if (kind === "video") {
      // Pure-JS video decoding is too heavy for an edge function and
      // subprocess ffmpeg is blocked by the runtime sandbox. Mark the
      // row ready without a thumbnail so the upload flow completes;
      // dimensions/duration will be filled in by a future worker.
      patch = {
        thumbnail_path: null,
        width: null,
        height: null,
        duration_seconds: null,
      }
    } else {
      // Other kinds (audio, pdf, …): no thumbnail.
      patch = { thumbnail_path: null }
    }

    await setStatus(mediaId, "ready", patch)
    return jsonResponse({ ok: true, kind, ...patch }, 200, origin)
  } catch (err) {
    console.error("generate-thumbnail: pipeline failed", err)
    await setStatus(mediaId, "failed")
    return jsonResponse({ error: "pipeline_failed" }, 500, origin)
  }
})
