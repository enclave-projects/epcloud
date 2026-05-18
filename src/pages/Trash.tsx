import * as React from "react"
import { formatDistanceToNowStrict } from "date-fns"
import {
  RiArrowGoBackLine,
  RiDeleteBinLine,
  RiInboxLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Thumbnail } from "@/components/dashboard/thumbnail"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useMediaList, useMediaRealtimeCounter } from "@/hooks/use-media"
import { useUploads } from "@/hooks/use-uploads"
import {
  permanentlyDeleteMedia,
  restoreMedia,
  type MediaRow,
} from "@/lib/media"
import { formatBytes } from "@/lib/storage"
import { cn } from "@/lib/utils"

export default function TrashPage() {
  const { user } = useAuth()
  const realtimeKey = useMediaRealtimeCounter(user?.id)
  const { changeCounter } = useUploads()
  const { rows, loading } = useMediaList(
    { trashed: true, limit: 200 },
    realtimeKey + changeCounter
  )

  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.id)))
  }

  const handleRestore = async () => {
    if (selected.size === 0) return
    setBusy(true)
    try {
      const count = await restoreMedia(Array.from(selected))
      toast.success(`Restored ${count} ${count === 1 ? "file" : "files"}`)
      setSelected(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed")
    } finally {
      setBusy(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (selected.size === 0) return
    const confirmed = window.confirm(
      `Permanently delete ${selected.size} ${selected.size === 1 ? "file" : "files"}? This removes them from storage forever and cannot be undone.`
    )
    if (!confirmed) return
    setBusy(true)
    try {
      const toDelete = rows.filter((r) => selected.has(r.id))
      const count = await permanentlyDeleteMedia(toDelete)
      toast.success(
        `Permanently deleted ${count} ${count === 1 ? "file" : "files"}`
      )
      setSelected(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setBusy(false)
    }
  }

  const handleEmptyTrash = async () => {
    if (rows.length === 0) return
    const confirmed = window.confirm(
      `Permanently delete ALL ${rows.length} files in trash? This removes them from storage forever and cannot be undone.`
    )
    if (!confirmed) return
    setBusy(true)
    try {
      const count = await permanentlyDeleteMedia(rows)
      toast.success(`Trash emptied (${count} files removed)`)
      setSelected(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to empty trash")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title="Trash"
          subtitle="Deleted files are kept here for 30 days before automatic permanent removal."
          crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Trash" }]}
          actions={
            rows.length > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEmptyTrash}
                disabled={busy}
              >
                <RiDeleteBinLine className="size-4" aria-hidden />
                Empty trash
              </Button>
            ) : undefined
          }
        />

        {/* Bulk action bar */}
        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.size === rows.length && rows.length > 0}
                onChange={selectAll}
                className="size-4 rounded border-muted-foreground/30"
              />
              {selected.size > 0
                ? `${selected.size} selected`
                : `Select all (${rows.length})`}
            </label>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={selected.size === 0 || busy}
              >
                <RiArrowGoBackLine className="size-4" aria-hidden />
                Restore
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handlePermanentDelete}
                disabled={selected.size === 0 || busy}
              >
                <RiDeleteBinLine className="size-4" aria-hidden />
                Delete forever
              </Button>
            </div>
          </div>
        ) : null}

        {loading && rows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg border bg-muted/40"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={RiInboxLine}
            title="Trash is empty"
            description="When you delete files, they'll appear here for 30 days before permanent removal."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="hidden grid-cols-12 gap-4 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:grid">
              <div className="col-span-1" />
              <div className="col-span-5">Name</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Deleted</div>
            </div>
            <ul role="list" className="divide-y">
              {rows.map((row) => (
                <TrashRow
                  key={row.id}
                  row={row}
                  selected={selected.has(row.id)}
                  onToggle={() => toggleSelect(row.id)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}

function TrashRow({
  row,
  selected,
  onToggle,
}: {
  row: MediaRow
  selected: boolean
  onToggle: () => void
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-12 items-center gap-3 px-4 py-2.5 sm:gap-4",
        selected && "bg-primary/5"
      )}
    >
      <div className="col-span-1 flex items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="size-4 rounded border-muted-foreground/30"
          aria-label={`Select ${row.original_filename}`}
        />
      </div>
      <div className="col-span-11 flex min-w-0 items-center gap-3 sm:col-span-5">
        <Thumbnail media={row} size="sm" />
        <p
          className="truncate text-sm font-medium opacity-60"
          title={row.original_filename}
        >
          {row.original_filename}
        </p>
      </div>
      <div className="col-span-2 hidden text-xs text-muted-foreground sm:block">
        {formatBytes(row.size_bytes)}
      </div>
      <div className="col-span-2 hidden text-xs text-muted-foreground capitalize sm:block">
        {row.kind}
      </div>
      <div className="col-span-2 hidden text-xs text-muted-foreground sm:block">
        {row.deleted_at
          ? formatDistanceToNowStrict(new Date(row.deleted_at), {
              addSuffix: true,
            })
          : "—"}
      </div>
    </li>
  )
}
