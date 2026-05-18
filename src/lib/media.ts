import { supabase } from "@/lib/supabase"
import {
  MEDIA_BUCKET,
  THUMBNAIL_BUCKET,
  classifyMime,
  buildStoragePath,
  getSignedUrl,
} from "@/lib/storage"
import type { Database } from "@/types/database"

export type MediaRow = Database["public"]["Tables"]["media"]["Row"]
export type MediaKind = Database["public"]["Enums"]["media_kind"]
export type MediaStatus = Database["public"]["Enums"]["media_status"]

export type MediaListFilters = {
  kind?: MediaKind | "all"
  search?: string
  folderId?: string | null
  /** Only items modified within the last N days. */
  recentDays?: number
  limit?: number
  offset?: number
  orderBy?: "created_at" | "original_filename" | "size_bytes"
  orderDir?: "asc" | "desc"
  /**
   * Which media statuses to include. Default: every active status so the
   * user can see uploading + failed rows immediately. Pass `["ready"]` to
   * restrict to fully processed media (e.g. for the public viewer).
   */
  statuses?: MediaStatus[]
  /** When true, show ONLY trashed items (deleted_at IS NOT NULL). */
  trashed?: boolean
}

export type MediaListResult = {
  rows: MediaRow[]
  count: number
}

export async function listMedia(
  filters: MediaListFilters = {}
): Promise<MediaListResult> {
  const {
    kind = "all",
    search,
    folderId,
    recentDays,
    limit = 50,
    offset = 0,
    orderBy = "created_at",
    orderDir = "desc",
    statuses = ["uploading", "processing", "ready", "failed"],
    trashed = false,
  } = filters

  let query = supabase
    .from("media")
    .select("*", { count: "exact" })
    .in("status", statuses)
    .order(orderBy, { ascending: orderDir === "asc" })
    .range(offset, offset + limit - 1)

  // Trash filter: show either active OR trashed items, never mixed.
  if (trashed) {
    query = query.not("deleted_at", "is", null)
  } else {
    query = query.is("deleted_at", null)
  }

  if (kind !== "all") query = query.eq("kind", kind)
  if (typeof folderId !== "undefined") {
    query = folderId === null ? query.is("folder_id", null) : query.eq("folder_id", folderId)
  }
  if (search) {
    // Trigram index supports ILIKE on original_filename
    query = query.ilike("original_filename", `%${search.replace(/[%_]/g, "")}%`)
  }
  if (recentDays && recentDays > 0) {
    const since = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000)
    query = query.gte("created_at", since.toISOString())
  }

  const { data, count, error } = await query
  if (error) throw error
  return { rows: data ?? [], count: count ?? 0 }
}

export async function getRecentMedia(limit = 8): Promise<MediaRow[]> {
  const { rows } = await listMedia({
    limit,
    orderBy: "created_at",
    orderDir: "desc",
  })
  return rows
}

export type CreateMediaRowInput = {
  ownerId: string
  filename: string
  mimeType: string
  sizeBytes: number
  contentHash?: string | null
  folderId?: string | null
}

/**
 * Create the `media` row BEFORE uploading. The id we receive becomes the
 * storage object name, and RLS guarantees only the owner can read/write it.
 * Returns the row plus the deterministic storage path the upload should use.
 */
export async function createMediaRow(input: CreateMediaRowInput) {
  const kind = classifyMime(input.mimeType)
  // Generate the id client-side so we know the storage path before insert.
  const id = crypto.randomUUID()
  const storagePath = buildStoragePath(
    input.ownerId,
    id,
    input.filename,
    input.mimeType
  )

  const { data, error } = await supabase
    .from("media")
    .insert({
      id,
      owner_id: input.ownerId,
      folder_id: input.folderId ?? null,
      original_filename: input.filename,
      mime_type: input.mimeType,
      kind,
      size_bytes: input.sizeBytes,
      content_hash: input.contentHash ?? null,
      storage_path: storagePath,
      status: "uploading",
    })
    .select()
    .single()

  if (error) throw error
  return { row: data, storagePath }
}

export async function markMediaProcessing(mediaId: string): Promise<void> {
  const { error } = await supabase
    .from("media")
    .update({ status: "processing" })
    .eq("id", mediaId)
  if (error) throw error
}

/**
 * Atomically flip a media row to 'ready', optionally patching the columns
 * the thumbnail pipeline is expected to populate. Used by:
 *   - the "no thumbnail needed" branch (just `{}`)
 *   - the client-side video thumbnail path (sets thumbnail_path, dims, duration)
 */
export async function markMediaReady(
  mediaId: string,
  patch: {
    thumbnail_path?: string | null
    width?: number | null
    height?: number | null
    duration_seconds?: number | null
  }
): Promise<void> {
  const { error } = await supabase
    .from("media")
    .update({ status: "ready", ...patch })
    .eq("id", mediaId)
  if (error) throw error
}

export async function markMediaFailed(mediaId: string): Promise<void> {
  const { error } = await supabase
    .from("media")
    .update({ status: "failed" })
    .eq("id", mediaId)
  if (error) throw error
}

/**
 * Re-trigger thumbnail generation for a failed media row. Sets status back
 * to 'processing' and invokes the edge function again. Useful when the
 * function had a transient error or was redeployed.
 *
 * Like the initial upload path, the invocation is serialized at module
 * level so two retries (or a retry plus a fresh upload) can never run the
 * thumbnail function concurrently and blow the edge-runtime memory cap.
 */
let retryQueue: Promise<unknown> = Promise.resolve()
export async function retryProcessing(mediaId: string): Promise<void> {
  const { error } = await supabase
    .from("media")
    .update({ status: "processing" })
    .eq("id", mediaId)
  if (error) throw error
  const next = retryQueue.then(() =>
    supabase.functions.invoke("generate-thumbnail", {
      body: { media_id: mediaId },
    })
  )
  retryQueue = next.catch(() => undefined)
  try {
    const result = (await next) as {
      error?: { message?: string } | null
    } | undefined
    if (result?.error) throw new Error(result.error.message ?? "retry failed")
  } catch (e) {
    await markMediaFailed(mediaId).catch(() => undefined)
    throw e
  }
}

export async function deleteMedia(row: MediaRow): Promise<void> {
  // Soft delete — move to trash. Share links auto-revoked by the RPC.
  await trashMedia([row.id])
}

/** Move one or more media items to trash. */
export async function trashMedia(mediaIds: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("trash_media", {
    p_media_ids: mediaIds,
  })
  if (error) throw error
  return (data as number) ?? 0
}

/** Restore one or more items from trash back to active. */
export async function restoreMedia(mediaIds: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("restore_media", {
    p_media_ids: mediaIds,
  })
  if (error) throw error
  return (data as number) ?? 0
}

/**
 * Permanently delete items that are already in trash.
 * Removes storage objects + DB rows. Irreversible.
 */
export async function permanentlyDeleteMedia(
  rows: MediaRow[]
): Promise<number> {
  // Remove storage objects first (owner-scoped RLS permits this)
  const mediaPaths = rows.map((r) => r.storage_path)
  const thumbPaths = rows
    .filter((r) => r.thumbnail_path)
    .map((r) => r.thumbnail_path!)

  if (mediaPaths.length > 0) {
    await supabase.storage.from(MEDIA_BUCKET).remove(mediaPaths)
  }
  if (thumbPaths.length > 0) {
    await supabase.storage.from(THUMBNAIL_BUCKET).remove(thumbPaths)
  }

  const { data, error } = await supabase.rpc("permanently_delete_media", {
    p_media_ids: rows.map((r) => r.id),
  })
  if (error) throw error
  return (data as number) ?? 0
}

export async function renameMedia(
  mediaId: string,
  newFilename: string
): Promise<void> {
  const trimmed = newFilename.trim()
  if (trimmed.length < 1 || trimmed.length > 255) {
    throw new Error("Filename must be 1-255 characters")
  }
  const { error } = await supabase
    .from("media")
    .update({ original_filename: trimmed })
    .eq("id", mediaId)
  if (error) throw error
}

/** Mint signed URLs for the given media row's main file and thumbnail. */
export async function signMediaUrls(row: MediaRow) {
  const [main, thumb] = await Promise.all([
    getSignedUrl(MEDIA_BUCKET, row.storage_path, 3600),
    row.thumbnail_path
      ? getSignedUrl(THUMBNAIL_BUCKET, row.thumbnail_path, 3600)
      : Promise.resolve(null),
  ])
  return { main, thumb }
}

export type StorageUsage = {
  used_bytes: number
  file_count: number
  image_count: number
  video_count: number
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const { data, error } = await supabase.rpc("get_user_storage_usage")
  if (error) throw error
  return (
    data?.[0] ?? {
      used_bytes: 0,
      file_count: 0,
      image_count: 0,
      video_count: 0,
    }
  )
}
