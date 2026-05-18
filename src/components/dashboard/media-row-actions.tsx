import {
  RiDeleteBinLine,
  RiEditLine,
  RiMoreLine,
  RiRefreshLine,
  RiShareLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  deleteMedia,
  renameMedia,
  retryProcessing,
  type MediaRow,
} from "@/lib/media"

export function MediaRowActions({
  media,
  onShare,
  onChanged,
}: {
  media: MediaRow
  onShare: (media: MediaRow) => void
  onChanged: () => void
}) {
  const isReady = media.status === "ready"
  const canRetry = media.status === "failed"

  const handleRename = async () => {
    const next = window.prompt("Rename file", media.original_filename)
    if (!next || next === media.original_filename) return
    try {
      await renameMedia(media.id, next)
      toast.success("Renamed")
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed")
    }
  }

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Move "${media.original_filename}" to trash?`
      )
    )
      return
    try {
      await deleteMedia(media)
      toast.success("Moved to trash")
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const handleRetry = async () => {
    try {
      await retryProcessing(media.id)
      toast.success("Retrying processing")
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${media.original_filename}`}
        >
          <RiMoreLine className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onShare(media)} disabled={!isReady}>
          <RiShareLine className="size-4" aria-hidden />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleRename}>
          <RiEditLine className="size-4" aria-hidden />
          Rename
        </DropdownMenuItem>
        {canRetry ? (
          <DropdownMenuItem onSelect={handleRetry}>
            <RiRefreshLine className="size-4" aria-hidden />
            Retry processing
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
          <RiDeleteBinLine className="size-4" aria-hidden />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
