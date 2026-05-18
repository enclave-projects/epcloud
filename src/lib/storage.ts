import { supabase } from "@/lib/supabase"
import { classifyFile, toMediaKind } from "@/lib/mime"

export const MEDIA_BUCKET = "media"
export const THUMBNAIL_BUCKET = "thumbnails"

// Per-kind size caps. The bucket itself caps at 2 GiB; we soft-limit
// images to keep the UI snappy.
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024 // 50 MB
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB
export const MAX_OTHER_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB (matches bucket)

export type MediaKind = "image" | "video" | "other"

/**
 * Reduce any file (mime + filename) to the three-value `media_kind` used
 * in the database. Re-exported for convenience; existing call-sites used
 * `classifyMime(mime)` so we keep that as a thin shim.
 */
export function classifyMime(mime: string, filename = ""): MediaKind {
  return toMediaKind(classifyFile(mime, filename))
}

/** Best-effort extension from filename or mime, never trusted directly. */
export function pickExtension(filename: string, mime: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot > 0 && dot < filename.length - 1) {
    const ext = filename.slice(dot + 1).toLowerCase()
    if (/^[a-z0-9]{1,8}$/.test(ext)) return ext
  }
  // Fallback to mime suffix
  const slash = mime.indexOf("/")
  if (slash > 0) {
    const ext = mime.slice(slash + 1).toLowerCase().split(";")[0]
    if (/^[a-z0-9]{1,8}$/.test(ext)) return ext
  }
  return "bin"
}

export function buildStoragePath(
  ownerId: string,
  mediaId: string,
  filename: string,
  mime: string
): string {
  return `${ownerId}/${mediaId}.${pickExtension(filename, mime)}`
}

/**
 * Mint a signed URL for an owned object. Used to display images/videos in
 * the dashboard. Default TTL is 1 hour — refreshed on demand by the UI.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds)
  if (error) {
    console.error("createSignedUrl error", error)
    return null
  }
  return data?.signedUrl ?? null
}

/**
 * Compute sha256 of a Blob/File using SubtleCrypto. Used so we can attach a
 * content_hash to media rows for dedup / integrity checks.
 */
export async function sha256Of(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const v = bytes / 1024 ** i
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}
