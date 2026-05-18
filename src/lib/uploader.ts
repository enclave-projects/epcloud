import * as tus from "tus-js-client"

import { supabase } from "@/lib/supabase"
import {
  MAX_IMAGE_BYTES,
  MAX_OTHER_BYTES,
  MAX_VIDEO_BYTES,
  MEDIA_BUCKET,
  THUMBNAIL_BUCKET,
  sha256Of,
} from "@/lib/storage"
import { classifyFile } from "@/lib/mime"
import { consumeRateLimit } from "@/lib/rate-limit"
import {
  createMediaRow,
  markMediaFailed,
  markMediaProcessing,
  markMediaReady,
} from "@/lib/media"
import { generateVideoThumbnail } from "@/lib/video-thumbnail"

// Limits enforced on the client. The DB CHECK constraints + storage bucket
// limits enforce them again server-side — never trust just one layer.
//
// 200/hr is comfortable for active users (bulk-imports, batch syncs, etc.)
// while still catching obvious abuse — no human pastes 200 files per hour
// by accident.
const UPLOAD_MAX_HITS = 200
const UPLOAD_WINDOW_S = 60 * 60

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const RESUMABLE_ENDPOINT = `${SUPABASE_URL}/storage/v1/upload/resumable`

const SHARP_FUNCTION = "generate-thumbnail"

// ---------------------------------------------------------------------------
// Thumbnail trigger queue
// ---------------------------------------------------------------------------
// generate-thumbnail decodes the full image in memory. If we invoke it for
// 3+ files in parallel, the edge-runtime user worker can blow past its
// per-isolate memory cap and the supervisor kills every active request —
// turning a successful 3-file upload into 3 failed thumbnails.
//
// Solution: serialize thumbnail invocations so only ONE runs at a time.
// The upload itself can still be parallel (we cap at 3 concurrent
// uploads) — only the post-upload processing call is queued.
let thumbnailQueue: Promise<unknown> = Promise.resolve()

function queueThumbnail(mediaId: string) {
  const next = thumbnailQueue.then(() =>
    supabase.functions.invoke(SHARP_FUNCTION, {
      body: { media_id: mediaId },
    })
  )
  thumbnailQueue = next.catch(() => undefined)
  return next
}

export type UploadStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "ready"
  | "failed"
  | "cancelled"

export type UploadJob = {
  id: string
  file: File
  mediaId?: string
  status: UploadStatus
  progress: number
  bytesUploaded: number
  bytesTotal: number
  error?: string
}

export type UploadJobUpdate = (job: UploadJob) => void

type UploadOptions = {
  ownerId: string
  folderId?: string | null
  onUpdate: UploadJobUpdate
  signal?: AbortSignal
}

/**
 * Validate a single file before we even create a DB row. The bucket allows
 * any mime type now, but we still cap by kind on the client for UX.
 */
export function validateFile(file: File): string | null {
  if (file.size === 0) return "File is empty."
  if (file.name.length > 255) return "Filename is too long (max 255 chars)."

  const fineKind = classifyFile(file.type || "", file.name)
  if (fineKind === "image" && file.size > MAX_IMAGE_BYTES) {
    return "Image is too large (max 50 MB)."
  }
  if (fineKind === "video" && file.size > MAX_VIDEO_BYTES) {
    return "Video is too large (max 2 GB)."
  }
  if (file.size > MAX_OTHER_BYTES) {
    return "File is too large (max 2 GB)."
  }
  return null
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new Error("Not signed in")
  }
  return data.session.access_token
}

/**
 * Client-side video thumbnail upload. Uses <video>+<canvas> to extract a
 * frame, encodes JPEG, uploads directly to the thumbnails bucket, and
 * patches the media row.
 *
 * This bypasses the supabase/edge-runtime sandbox (which blocks ffmpeg).
 */
async function generateAndUploadVideoThumbnail(
  file: File,
  ownerId: string,
  mediaId: string
): Promise<void> {
  const { blob, width, height, durationSeconds } =
    await generateVideoThumbnail(file)

  const path = `${ownerId}/${mediaId}.jpg`
  const { error: uploadErr } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    })
  if (uploadErr) throw uploadErr

  await markMediaReady(mediaId, {
    thumbnail_path: path,
    width,
    height,
    duration_seconds: durationSeconds,
  })
}

/**
 * TUS resumable upload to Supabase Storage. Emits progress on every chunk.
 *
 * Pipeline:
 *   1. Client-side validate
 *   2. Per-user rate limit (DB-side atomic)
 *   3. Compute sha256 (cheap, used for dedup later)
 *   4. Insert media row with status='uploading'
 *   5. TUS upload with progress
 *   6. Mark status='processing'
 *   7a. Image → call edge function (queued)
 *   7b. Video → generate thumbnail in browser, upload directly
 *   7c. Other → no thumbnail; flip straight to ready
 */
export async function uploadFile(
  job: UploadJob,
  opts: UploadOptions
): Promise<void> {
  const update = (patch: Partial<UploadJob>) => {
    Object.assign(job, patch)
    opts.onUpdate(job)
  }

  // 1. Validate ----------------------------------------------------------
  const err = validateFile(job.file)
  if (err) {
    update({ status: "failed", error: err })
    return
  }

  // 2. Rate limit --------------------------------------------------------
  const allowed = await consumeRateLimit(
    `upload:${opts.ownerId}`,
    UPLOAD_MAX_HITS,
    UPLOAD_WINDOW_S
  )
  if (!allowed) {
    update({
      status: "failed",
      error: "You're uploading too quickly. Please wait a moment.",
    })
    return
  }

  // 3. Hash --------------------------------------------------------------
  let contentHash: string | null = null
  try {
    contentHash = await sha256Of(job.file)
  } catch {
    // Non-fatal — proceed without a hash
  }

  // 4. Insert row --------------------------------------------------------
  let mediaId: string
  let storagePath: string
  try {
    const created = await createMediaRow({
      ownerId: opts.ownerId,
      filename: job.file.name,
      mimeType: job.file.type || "application/octet-stream",
      sizeBytes: job.file.size,
      contentHash,
      folderId: opts.folderId ?? null,
    })
    mediaId = created.row.id
    storagePath = created.storagePath
  } catch (e) {
    update({
      status: "failed",
      error: e instanceof Error ? e.message : "Failed to create media row",
    })
    return
  }

  update({ mediaId, status: "uploading" })

  // 5. TUS upload --------------------------------------------------------
  const accessToken = await getAccessToken()

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(job.file, {
      endpoint: RESUMABLE_ENDPOINT,
      retryDelays: [0, 1000, 3000, 5000, 10_000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: MEDIA_BUCKET,
        objectName: storagePath,
        contentType: job.file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (e) => {
        markMediaFailed(mediaId).catch(() => undefined)
        reject(e)
      },
      onProgress: (uploaded, total) => {
        update({
          bytesUploaded: uploaded,
          bytesTotal: total,
          progress: total > 0 ? uploaded / total : 0,
        })
      },
      onSuccess: () => resolve(),
    })

    if (opts.signal) {
      const onAbort = () => {
        upload.abort()
        markMediaFailed(mediaId).catch(() => undefined)
        update({ status: "cancelled" })
        reject(new DOMException("Upload aborted", "AbortError"))
      }
      if (opts.signal.aborted) onAbort()
      else opts.signal.addEventListener("abort", onAbort, { once: true })
    }

    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    })
  })

  update({ status: "processing", progress: 1 })

  // 6 + 7. Mark processing + per-kind processing path -------------------
  const fineKind = classifyFile(job.file.type || "", job.file.name)
  try {
    await markMediaProcessing(mediaId)

    if (fineKind === "image") {
      // Server-side via the edge function (serialized to avoid OOMs)
      const result = (await queueThumbnail(mediaId)) as
        | { error?: { message?: string } | null }
        | undefined
      if (result?.error) {
        throw new Error(result.error.message ?? "thumbnail generation failed")
      }
    } else if (fineKind === "video") {
      // Client-side: extract a frame in the browser, upload directly
      await generateAndUploadVideoThumbnail(job.file, opts.ownerId, mediaId)
    } else {
      // Documents, archives, code, etc — no thumbnail, just mark ready
      await markMediaReady(mediaId, {})
    }

    update({ status: "ready" })
  } catch (e) {
    console.error("post-upload processing failed", e)
    await markMediaFailed(mediaId).catch(() => undefined)
    update({
      status: "failed",
      error:
        e instanceof Error
          ? `${e.message}. The file is uploaded — retry from the file menu.`
          : "Post-upload processing failed",
    })
  }
}

/** Convenience: kick off many uploads in parallel with a small concurrency cap. */
export async function uploadMany(
  files: File[],
  opts: UploadOptions & {
    onJobCreated?: (job: UploadJob) => void
    concurrency?: number
  }
): Promise<void> {
  const jobs: UploadJob[] = files.map((f) => ({
    id: crypto.randomUUID(),
    file: f,
    status: "queued",
    progress: 0,
    bytesUploaded: 0,
    bytesTotal: f.size,
  }))
  jobs.forEach((j) => opts.onJobCreated?.(j))

  const concurrency = Math.min(opts.concurrency ?? 3, jobs.length)
  const queue = jobs.slice()

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const job = queue.shift()
        if (!job) break
        try {
          await uploadFile(job, opts)
        } catch (e) {
          if (job.status !== "cancelled") {
            opts.onUpdate({
              ...job,
              status: "failed",
              error: e instanceof Error ? e.message : "Upload failed",
            })
          }
        }
      }
    })
  )
}
