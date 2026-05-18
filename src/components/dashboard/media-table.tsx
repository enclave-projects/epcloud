import * as React from "react"
import { formatDistanceToNowStrict } from "date-fns"

import { Thumbnail } from "@/components/dashboard/thumbnail"
import { MediaRowActions } from "@/components/dashboard/media-row-actions"
import { MediaPreviewDialog } from "@/components/dashboard/media-preview-dialog"
import { BulkActions } from "@/components/dashboard/bulk-actions"
import { Skeleton } from "@/components/ui/skeleton"
import { formatBytes } from "@/lib/storage"
import type { MediaRow } from "@/lib/media"
import { cn } from "@/lib/utils"

type Props = {
  rows: MediaRow[]
  loading: boolean
  emptyState?: React.ReactNode
  onShare: (media: MediaRow | MediaRow[]) => void
  onChanged: () => void
  /** Enable checkboxes + bulk action bar. */
  selectable?: boolean
}

export function MediaTable({
  rows,
  loading,
  emptyState,
  onShare,
  onChanged,
  selectable = false,
}: Props) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [previewMedia, setPreviewMedia] = React.useState<MediaRow | null>(null)
  // Filter selected to only include ids still in current rows
  const validSelected = React.useMemo(
    () => new Set(Array.from(selected).filter((id) => rows.some((r) => r.id === id))),
    [selected, rows]
  )

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (validSelected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.id)))
  }

  if (loading && rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border bg-background">
        <TableHeader selectable={false} allSelected={false} onSelectAll={() => undefined} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <Skeleton className="size-9 rounded-md" />
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="ml-auto h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-8" />
          </div>
        ))}
      </div>
    )
  }

  if (rows.length === 0) return <>{emptyState}</>

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border bg-background">
        <TableHeader selectable={selectable} allSelected={validSelected.size === rows.length && rows.length > 0} onSelectAll={selectAll} />
        <ul role="list" className="divide-y">
          {rows.map((row) => (
            <li
              key={row.id}
              onDoubleClick={() => {
                if (row.status === "ready") setPreviewMedia(row)
              }}
              className={cn(
                "grid cursor-pointer grid-cols-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 sm:gap-4",
                validSelected.has(row.id) && "bg-primary/5"
              )}
            >
              {/* Checkbox */}
              {selectable ? (
                <div className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={validSelected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    className="size-4 rounded border-muted-foreground/30"
                    aria-label={`Select ${row.original_filename}`}
                  />
                </div>
              ) : null}

              {/* Name + thumbnail */}
              <div
                className={cn(
                  "flex min-w-0 cursor-pointer items-center gap-3",
                  selectable ? "col-span-11 sm:col-span-4" : "col-span-12 sm:col-span-5"
                )}
                onClick={() => {
                  if (row.status === "ready") setPreviewMedia(row)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && row.status === "ready") {
                    e.preventDefault()
                    setPreviewMedia(row)
                  }
                }}
                aria-label={`Preview ${row.original_filename}`}
              >
                <Thumbnail media={row} size="sm" />
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium leading-tight"
                    title={row.original_filename}
                  >
                    {row.original_filename}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">
                    {formatBytes(row.size_bytes)} ·{" "}
                    {formatDistanceToNowStrict(new Date(row.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="hidden sm:col-span-2 sm:block">
                <StatusBadge status={row.status} />
              </div>

              {/* Size */}
              <div className="hidden text-xs text-muted-foreground sm:col-span-2 sm:block">
                {formatBytes(row.size_bytes)}
              </div>

              {/* Modified */}
              <div className="hidden text-xs text-muted-foreground sm:col-span-2 sm:block">
                {formatDistanceToNowStrict(new Date(row.created_at), {
                  addSuffix: true,
                })}
              </div>

              {/* Actions */}
              <div className="col-span-12 flex justify-end sm:col-span-1">
                <MediaRowActions
                  media={row}
                  onShare={(m) => onShare(m)}
                  onChanged={onChanged}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Floating bulk toolbar */}
      {selectable ? (
        <BulkActions
          selected={validSelected}
          rows={rows}
          onClear={() => setSelected(new Set())}
          onShare={(selectedRows) => onShare(selectedRows)}
          onChanged={onChanged}
        />
      ) : null}

      {/* Media preview lightbox */}
      <MediaPreviewDialog
        media={previewMedia}
        rows={rows.filter((r) => r.status === "ready")}
        onClose={() => setPreviewMedia(null)}
        onNavigate={(m) => setPreviewMedia(m)}
      />
    </div>
  )
}

function TableHeader({ selectable, allSelected, onSelectAll }: { selectable: boolean; allSelected: boolean; onSelectAll: () => void }) {
  return (
    <div className="hidden grid-cols-12 gap-4 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:grid">
      {selectable ? (
        <div className="col-span-1 flex items-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="size-4 rounded border-muted-foreground/30"
            aria-label="Select all"
          />
        </div>
      ) : null}
      <div className={selectable ? "col-span-4" : "col-span-5"}>Name</div>
      <div className="col-span-2">Status</div>
      <div className="col-span-2">Size</div>
      <div className="col-span-2">Modified</div>
      <div className="col-span-1 text-right">Actions</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    { label: string; className: string; dot: string; animate?: boolean }
  > = {
    uploading: {
      label: "Uploading",
      className:
        "border-primary/40 bg-primary/10 text-primary",
      dot: "bg-primary",
      animate: true,
    },
    processing: {
      label: "Processing",
      className:
        "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
      animate: true,
    },
    ready: {
      label: "Ready",
      className:
        "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    failed: {
      label: "Failed",
      className:
        "border-destructive/40 bg-destructive/10 text-destructive",
      dot: "bg-destructive",
    },
  }
  const v = variants[status]
  if (!v) return null
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        v.className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          v.dot,
          v.animate && "animate-pulse"
        )}
      />
      {v.label}
    </span>
  )
}
