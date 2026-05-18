import { Link } from "react-router-dom"
import { formatDistanceToNowStrict } from "date-fns"
import { RiCheckboxCircleFill } from "@remixicon/react"

import { Skeleton } from "@/components/ui/skeleton"
import { Thumbnail } from "@/components/dashboard/thumbnail"
import { useLongPress } from "@/hooks/use-long-press"
import { formatBytes } from "@/lib/storage"
import type { MediaRow } from "@/lib/media"
import { cn } from "@/lib/utils"

type Props = {
  rows: MediaRow[]
  loading: boolean
  /** Called when user long-presses a card. Parent can use this to toggle selection. */
  onLongPressSelect?: (id: string) => void
  /** Set of currently selected ids — shows visual indicator on cards. */
  selectedIds?: Set<string>
}

export function RecentsRail({ rows, loading, onLongPressSelect, selectedIds }: Props) {
  return (
    <section aria-labelledby="recents-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2
          id="recents-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Recent uploads
        </h2>
        <Link
          to="/dashboard/recent"
          className="text-xs font-medium text-primary hover:underline"
        >
          See all
        </Link>
      </div>

      {loading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border bg-background"
            >
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border bg-background px-4 py-8 text-center text-xs text-muted-foreground">
          You haven't uploaded anything yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <RecentCard
              key={row.id}
              row={row}
              selected={selectedIds?.has(row.id) ?? false}
              onLongPress={onLongPressSelect ? () => onLongPressSelect(row.id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}


function RecentCard({
  row,
  selected,
  onLongPress,
}: {
  row: MediaRow
  selected: boolean
  onLongPress?: () => void
}) {
  const longPressHandlers = useLongPress(
    () => onLongPress?.(),
    500
  )

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border bg-background transition-all select-none",
        selected && "ring-2 ring-primary ring-offset-2"
      )}
      {...(onLongPress ? longPressHandlers : {})}
    >
      {selected ? (
        <span className="absolute top-2 right-2 z-10">
          <RiCheckboxCircleFill className="size-5 text-primary drop-shadow" />
        </span>
      ) : null}
      <div className="aspect-video bg-muted">
        <Thumbnail media={row} size="lg" className="rounded-none border-0" />
      </div>
      <div className="space-y-1 p-3">
        <p
          className="truncate text-xs font-medium"
          title={row.original_filename}
        >
          {row.original_filename}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatBytes(row.size_bytes)} ·{" "}
          {formatDistanceToNowStrict(new Date(row.created_at), {
            addSuffix: true,
          })}
        </p>
      </div>
    </article>
  )
}
