import * as React from "react"
import { RiLoader4Line } from "@remixicon/react"

import { FileTypeIcon } from "@/components/dashboard/file-type-icon"
import { THUMBNAIL_BUCKET, getSignedUrl } from "@/lib/storage"
import { cn } from "@/lib/utils"
import type { MediaRow } from "@/lib/media"

const URL_CACHE = new Map<string, { url: string; expires: number }>()

async function getCachedSignedUrl(path: string): Promise<string | null> {
  const cached = URL_CACHE.get(path)
  if (cached && cached.expires > Date.now() + 30_000) return cached.url
  const url = await getSignedUrl(THUMBNAIL_BUCKET, path, 3600)
  if (url) URL_CACHE.set(path, { url, expires: Date.now() + 3600_000 })
  return url
}

type Props = {
  media: MediaRow
  className?: string
  /** Render an extra-large preview (used in detail / share view). */
  size?: "sm" | "md" | "lg"
}

export function Thumbnail({ media, className, size = "md" }: Props) {
  const [src, setSrc] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    if (media.thumbnail_path && media.status === "ready") {
      void getCachedSignedUrl(media.thumbnail_path).then((url) => {
        if (!cancelled) setSrc(url)
      })
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSrc(null)
    }
    return () => {
      cancelled = true
    }
  }, [media.thumbnail_path, media.status])

  const dims =
    size === "sm" ? "size-9" : size === "lg" ? "aspect-video w-full" : "size-12"

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(
          "shrink-0 overflow-hidden rounded-md border bg-muted object-cover",
          dims,
          className
        )}
      />
    )
  }

  // No thumbnail yet — render a kind-aware icon placeholder.
  if (media.status === "uploading" || media.status === "processing") {
    return (
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-md border bg-muted text-muted-foreground",
          dims,
          className
        )}
      >
        <RiLoader4Line className="size-4 animate-spin" />
      </span>
    )
  }

  const iconSize =
    size === "sm" ? "size-4" : size === "lg" ? "size-8" : "size-5"

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-md border bg-muted",
        dims,
        className
      )}
    >
      <FileTypeIcon
        mime={media.mime_type}
        filename={media.original_filename}
        className={iconSize}
      />
    </span>
  )
}
