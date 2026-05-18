// EP Cloud — resolve-share Edge Function
// =======================================
// Public endpoint hit by the EP Cloud embed page when a viewer opens a
// share link. No JWT required. The function:
//   1. Rate-limits per IP via public.consume_rate_limit (sliding window).
//   2. Hashes the supplied token (sha256 hex) and forwards it together
//      with password / origin / hashed-IP / user-agent to
//      public.resolve_share_link (service role).
//   3. On success, mints short-lived signed URLs for the original media
//      and (optionally) its thumbnail.
//
// Token / password values are never logged.
//
// Required env (auto-injected by edge-runtime):
//   SUPABASE_URL              — internal kong url (http://kong:8000)
//   SUPABASE_SERVICE_ROLE_KEY — service role key
//
// Optional env:
//   RESOLVE_SHARE_RATE_MAX        default 60
//   RESOLVE_SHARE_RATE_WINDOW_S   default 60
//   RESOLVE_SHARE_RATE_BLOCK_S    default 300
//   RESOLVE_SHARE_SIGNED_URL_TTL  default 300 (seconds)

import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

// ----- config -------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const RATE_MAX = parseIntEnv("RESOLVE_SHARE_RATE_MAX", 60)
const RATE_WINDOW_S = parseIntEnv("RESOLVE_SHARE_RATE_WINDOW_S", 60)
const RATE_BLOCK_S = parseIntEnv("RESOLVE_SHARE_RATE_BLOCK_S", 300)
const SIGNED_URL_TTL = parseIntEnv("RESOLVE_SHARE_SIGNED_URL_TTL", 300)

const MEDIA_BUCKET = "media"
const THUMB_BUCKET = "thumbnails"

// CORS allowlist. The embed page may live on any of these origins.
// TODO: append the production EP Cloud frontend domain when known.
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "https://supabase.enclaveprojects.dev",
])

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "resolve-share: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  )
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ----- helpers ------------------------------------------------------------

function parseIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name)
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const STRICT_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
}

function corsHeaders(origin: string | null): Record<string, string> {
  // For a public endpoint we still echo back only known origins so the
  // browser refuses requests from unexpected sites.
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : ""
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
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
  // base64url-encoded 32 bytes ⇒ 43 chars unpadded; allow up to 128 just
  // in case clients pad or use alternate encodings.
  token: z
    .string()
    .min(8)
    .max(256)
    .regex(/^[A-Za-z0-9_\-=]+$/, "invalid token"),
  password: z.string().max(256).optional(),
})

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Best-effort client IP detection. We try the Cloudflare/proxy headers
 * first, fall back to the first hop of X-Forwarded-For, and finally to
 * an opaque "unknown" marker. The IP itself is never returned to the
 * caller — we sha256 it before passing to the DB.
 */
function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")
  if (cf) return cf.trim()
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  const xreal = req.headers.get("x-real-ip")
  if (xreal) return xreal.trim()
  return "unknown"
}

interface RpcRow {
  link_id: string | null
  media_id: string | null
  storage_path: string | null
  thumbnail_path: string | null
  mime_type: string | null
  kind: "image" | "video" | "other" | null
  size_bytes: number | null
  width: number | null
  height: number | null
  duration_seconds: number | string | null
  original_filename: string | null
  allow_download: boolean | null
  allow_embed: boolean | null
  outcome: string
}

const FAILURE_OUTCOMES = new Set([
  "expired",
  "revoked",
  "view_limit",
  "invalid_password",
  "origin_denied",
])

// ----- main handler -------------------------------------------------------

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }
  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "method_not_allowed" },
      405,
      origin
    )
  }

  // 1. Parse + validate body. Never log it.
  let token: string
  let password: string | undefined
  try {
    const body = await req.json()
    const parsed = inputSchema.parse(body)
    token = parsed.token
    password = parsed.password
  } catch (_err) {
    return jsonResponse(
      { ok: false, error: "invalid_body" },
      400,
      origin
    )
  }

  // 2. Compute hashed IP for both rate limiting and audit.
  const ip = clientIp(req)
  const ipHash = await sha256Hex(ip)

  // 3. Rate limit BEFORE doing any DB work.
  try {
    const { data: allowed, error } = await admin.rpc("consume_rate_limit", {
      p_bucket_key: `share-resolve:${ipHash}`,
      p_max_hits: RATE_MAX,
      p_window_seconds: RATE_WINDOW_S,
      p_block_seconds: RATE_BLOCK_S,
    })
    if (error) {
      console.error("resolve-share: rate limit rpc failed", error.message)
      // Fail closed on rate limiter errors — safer than open.
      return jsonResponse(
        { ok: false, outcome: "rate_limited" },
        429,
        origin
      )
    }
    if (allowed === false) {
      return jsonResponse(
        { ok: false, outcome: "rate_limited" },
        429,
        origin
      )
    }
  } catch (err) {
    console.error("resolve-share: rate limit threw", err)
    return jsonResponse(
      { ok: false, outcome: "rate_limited" },
      429,
      origin
    )
  }

  // 4. Hash the token, then call resolve_share_link.
  const tokenHash = await sha256Hex(token)
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 256)
  const originHeader = origin ?? ""

  let row: RpcRow | null
  try {
    const { data, error } = await admin.rpc("resolve_share_link", {
      p_token_hash: tokenHash,
      p_password: password ?? null,
      p_origin: originHeader,
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
    })
    if (error) {
      console.error("resolve-share: rpc failed", error.message)
      return jsonResponse(
        { ok: false, error: "internal_error" },
        500,
        origin
      )
    }
    // RPC returns SETOF, supabase-js gives us an array.
    row = Array.isArray(data) ? (data[0] as RpcRow) ?? null : (data as RpcRow)
  } catch (err) {
    console.error("resolve-share: rpc threw", err)
    return jsonResponse(
      { ok: false, error: "internal_error" },
      500,
      origin
    )
  }

  if (!row) {
    return jsonResponse(
      { ok: false, outcome: "not_found" },
      404,
      origin
    )
  }

  const outcome = row.outcome

  if (outcome === "not_found") {
    return jsonResponse({ ok: false, outcome }, 404, origin)
  }

  if (FAILURE_OUTCOMES.has(outcome)) {
    return jsonResponse({ ok: false, outcome }, 403, origin)
  }

  if (outcome !== "success") {
    // Defensive: unknown outcome from RPC.
    console.error("resolve-share: unknown outcome", outcome)
    return jsonResponse(
      { ok: false, error: "internal_error" },
      500,
      origin
    )
  }

  // 5. Mint signed URLs.
  if (!row.storage_path) {
    console.error("resolve-share: success without storage_path")
    return jsonResponse(
      { ok: false, error: "internal_error" },
      500,
      origin
    )
  }

  let signedUrl: string | null = null
  let thumbnailUrl: string | null = null

  try {
    const { data, error } = await admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(row.storage_path, SIGNED_URL_TTL)
    if (error || !data) {
      console.error(
        "resolve-share: createSignedUrl(media) failed",
        error?.message
      )
      return jsonResponse(
        { ok: false, error: "internal_error" },
        500,
        origin
      )
    }
    signedUrl = data.signedUrl
  } catch (err) {
    console.error("resolve-share: signed url media threw", err)
    return jsonResponse(
      { ok: false, error: "internal_error" },
      500,
      origin
    )
  }

  if (row.thumbnail_path) {
    try {
      const { data, error } = await admin.storage
        .from(THUMB_BUCKET)
        .createSignedUrl(row.thumbnail_path, SIGNED_URL_TTL)
      if (!error && data) thumbnailUrl = data.signedUrl
    } catch (err) {
      // Thumbnail is best-effort; do not fail the whole response.
      console.error("resolve-share: signed url thumbnail threw", err)
    }
  }

  const duration =
    row.duration_seconds == null
      ? null
      : typeof row.duration_seconds === "string"
        ? Number.parseFloat(row.duration_seconds)
        : row.duration_seconds

  return jsonResponse(
    {
      ok: true,
      media: {
        mime_type: row.mime_type,
        kind: row.kind,
        width: row.width,
        height: row.height,
        duration_seconds: duration,
        original_filename: row.original_filename,
        allow_download: !!row.allow_download,
        allow_embed: row.allow_embed !== false,
        signed_url: signedUrl,
        thumbnail_url: thumbnailUrl,
      },
    },
    200,
    origin
  )
})
