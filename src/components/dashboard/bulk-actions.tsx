import * as React from "react"
import {
  RiCloseLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiShareLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { trashMedia, type MediaRow } from "@/lib/media"
import { cn } from "@/lib/utils"

type BulkActionsProps = {
  selected: Set<string>
  rows: MediaRow[]
  onClear: () => void
  onShare: (rows: MediaRow[]) => void
  onChanged: () => void
}

/**
 * Floating bulk-action toolbar. Appears at the bottom of the viewport when
 * one or more items are selected. Inspired by Google Drive's bulk bar.
 */
export function BulkActions({
  selected,
  rows,
  onClear,
  onShare,
  onChanged,
}: BulkActionsProps) {
  const [busy, setBusy] = React.useState(false)
  const count = selected.size

  if (count === 0) return null

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const readyRows = selectedRows.filter((r) => r.status === "ready")

  const handleTrash = async () => {
    if (!window.confirm(`Move ${count} ${count === 1 ? "file" : "files"} to trash?`)) return
    setBusy(true)
    try {
      await trashMedia(Array.from(selected))
      toast.success(`Moved ${count} ${count === 1 ? "file" : "files"} to trash`)
      onClear()
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to move to trash")
    } finally {
      setBusy(false)
    }
  }

  const handleShare = () => {
    if (readyRows.length === 0) {
      toast.error("Only fully processed files can be shared")
      return
    }
    onShare(readyRows)
  }

  const handleDownload = async () => {
    if (readyRows.length === 0) {
      toast.error("Only fully processed files can be downloaded")
      return
    }
    // For bulk download we open signed URLs in new tabs (browser handles download)
    // A proper zip stream would be a future enhancement.
    const { supabase } = await import("@/lib/supabase")
    const { MEDIA_BUCKET } = await import("@/lib/storage")

    setBusy(true)
    try {
      for (const row of readyRows) {
        const { data } = await supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(row.storage_path, 60, {
            download: row.original_filename,
          })
        if (data?.signedUrl) {
          // Use a hidden anchor to trigger download without popup blockers
          const a = document.createElement("a")
          a.href = data.signedUrl
          a.download = row.original_filename
          a.style.display = "none"
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          // Small delay between downloads to avoid browser throttling
          await new Promise((r) => setTimeout(r, 300))
        }
      }
      toast.success(`Downloading ${readyRows.length} ${readyRows.length === 1 ? "file" : "files"}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-2 rounded-lg border bg-background px-4 py-2.5 shadow-xl",
        "animate-in slide-in-from-bottom-4 fade-in duration-200"
      )}
    >
      <span className="mr-1 text-sm font-medium">
        {count} {count === 1 ? "file" : "files"} selected
      </span>

      <div className="h-5 w-px bg-border" />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        disabled={busy || readyRows.length === 0}
        title={readyRows.length === 0 ? "Only ready files can be shared" : "Share selected files"}
      >
        <RiShareLine className="size-4" aria-hidden />
        Share
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={busy || readyRows.length === 0}
        title="Download selected files"
      >
        <RiDownloadLine className="size-4" aria-hidden />
        Download
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleTrash}
        disabled={busy}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <RiDeleteBinLine className="size-4" aria-hidden />
        Trash
      </Button>

      <div className="h-5 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <RiCloseLine className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
