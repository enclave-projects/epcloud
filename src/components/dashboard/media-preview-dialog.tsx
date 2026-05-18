import * as React from "react"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiDownloadLine,
  RiFullscreenLine,
  RiFullscreenExitLine,
  RiFileLine,
  RiLoader4Line,
} from "@remixicon/react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { formatBytes } from "@/lib/storage"
import { signMediaUrls, type MediaRow } from "@/lib/media"
import { cn } from "@/lib/utils"

type Props = {
  /** The media item to preview. `null` closes the dialog. */
  media: MediaRow | null
  /** All rows in the current list — used for prev/next navigation. */
  rows: MediaRow[]
  onClose: () => void
  onNavigate: (media: MediaRow) => void
}

export function MediaPreviewDialog({ media, rows, onClose, onNavigate }: Props) {
  const [mainUrl, setMainUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)

  // Find current index for navigation
  const currentIndex = media ? rows.findIndex((r) => r.id === media.id) : -1
  const prevItem = currentIndex > 0 ? rows[currentIndex - 1] : null
  const nextItem = currentIndex < rows.length - 1 ? rows[currentIndex + 1] : null

  // Fetch signed URL when media changes
  React.useEffect(() => {
    if (!media || media.status !== "ready") {
      setMainUrl(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    signMediaUrls(media)
      .then(({ main }) => {
        if (cancelled) return
        setMainUrl(main)
      })
      .catch(() => {
        if (cancelled) return
        setError("Failed to load preview. Please try again.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [media?.id, media?.status])

  // Keyboard navigation
  React.useEffect(() => {
    if (!media) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prevItem) {
        e.preventDefault()
        onNavigate(prevItem)
      } else if (e.key === "ArrowRight" && nextItem) {
        e.preventDefault()
        onNavigate(nextItem)
      } else if (e.key === "Escape" && isFullscreen) {
        e.preventDefault()
        exitFullscreen()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [media, prevItem, nextItem, isFullscreen])

  // Fullscreen handling
  const enterFullscreen = async () => {
    try {
      if (containerRef.current) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  }

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
      setIsFullscreen(false)
    } catch {
      setIsFullscreen(false)
    }
  }

  // Sync fullscreen state with browser events
  React.useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  // Download via signed URL — opens in new tab to avoid CORS issues
  const handleDownload = () => {
    if (!mainUrl || !media) return
    const a = document.createElement("a")
    a.href = mainUrl
    a.download = media.original_filename
    a.rel = "noopener noreferrer"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const isOpen = media !== null

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Content
          ref={containerRef}
          aria-label={media ? `Preview: ${media.original_filename}` : "Media preview"}
          className={cn(
            "fixed inset-0 z-50 flex flex-col outline-none",
            isFullscreen && "bg-black"
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* Top bar */}
          <div className="flex shrink-0 items-center justify-between gap-4 bg-black/60 px-4 py-3 text-white">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {media?.original_filename}
              </p>
              <p className="text-xs text-white/60">
                {media ? formatBytes(media.size_bytes) : ""}
                {currentIndex >= 0 && (
                  <span className="ml-2">
                    {currentIndex + 1} / {rows.length}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10"
                onClick={handleDownload}
                disabled={!mainUrl}
                aria-label="Download file"
              >
                <RiDownloadLine className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10"
                onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <RiFullscreenExitLine className="size-4" />
                ) : (
                  <RiFullscreenLine className="size-4" />
                )}
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/10"
                  aria-label="Close preview"
                >
                  <RiCloseLine className="size-5" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Main content area */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {/* Previous button */}
            {prevItem && (
              <button
                onClick={() => onNavigate(prevItem)}
                className="absolute left-2 z-10 grid size-10 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70 sm:left-4 sm:size-12"
                aria-label="Previous file"
              >
                <RiArrowLeftSLine className="size-6" />
              </button>
            )}

            {/* Media content */}
            <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
              <PreviewContent
                media={media}
                url={mainUrl}
                loading={loading}
                error={error}
              />
            </div>

            {/* Next button */}
            {nextItem && (
              <button
                onClick={() => onNavigate(nextItem)}
                className="absolute right-2 z-10 grid size-10 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70 sm:right-4 sm:size-12"
                aria-label="Next file"
              >
                <RiArrowRightSLine className="size-6" />
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PreviewContent({
  media,
  url,
  loading,
  error,
}: {
  media: MediaRow | null
  url: string | null
  loading: boolean
  error: string | null
}) {
  if (!media) return null

  if (media.status !== "ready") {
    return (
      <div className="flex flex-col items-center gap-3 text-white/70">
        <RiLoader4Line className="size-8 animate-spin" />
        <p className="text-sm">
          {media.status === "uploading"
            ? "File is still uploading…"
            : media.status === "processing"
              ? "File is being processed…"
              : "File processing failed."}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/70">
        <RiLoader4Line className="size-8 animate-spin" />
        <p className="text-sm">Loading preview…</p>
      </div>
    )
  }

  if (error || !url) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/70">
        <RiFileLine className="size-12" />
        <p className="text-sm">{error ?? "Preview not available."}</p>
      </div>
    )
  }

  if (media.kind === "image") {
    return (
      <img
        src={url}
        alt={media.original_filename}
        className="max-h-full max-w-full rounded-md object-contain"
        draggable={false}
      />
    )
  }

  if (media.kind === "video") {
    return (
      <video
        src={url}
        controls
        autoPlay
        playsInline
        className="max-h-full max-w-full rounded-md"
        controlsList="nodownload"
      >
        <track kind="captions" />
        Your browser does not support video playback.
      </video>
    )
  }

  // Non-image, non-video: show file info with download prompt
  return (
    <div className="flex flex-col items-center gap-4 text-white/70">
      <RiFileLine className="size-16" />
      <div className="text-center">
        <p className="text-sm font-medium text-white">
          {media.original_filename}
        </p>
        <p className="mt-1 text-xs">{media.mime_type}</p>
        <p className="mt-3 text-xs">
          No preview available. Use the download button to view this file.
        </p>
      </div>
    </div>
  )
}
