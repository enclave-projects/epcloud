import * as React from "react"
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiTimeLine,
  RiUploadCloud2Line,
} from "@remixicon/react"

import { useUploads } from "@/hooks/use-uploads"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FileTypeIcon } from "@/components/dashboard/file-type-icon"
import { formatBytes } from "@/lib/storage"
import type { UploadJob, UploadStatus } from "@/lib/uploader"
import { cn } from "@/lib/utils"

/**
 * Bottom-right upload progress tray. Auto-shows when there are active jobs.
 * Inspired by Dropbox's "uploading" surface — collapsible, dismissible only
 * when every job has finished.
 *
 * Auto-collapses to a compact summary 5 seconds after every job finishes,
 * so the tray doesn't overlap the file table indefinitely. The user can
 * still open it back up to inspect failures.
 */
export function UploadTray() {
  const { jobs, clearFinished } = useUploads()
  const [collapsed, setCollapsed] = React.useState(false)
  const [userToggled, setUserToggled] = React.useState(false)

  const finished = jobs.filter(
    (j) =>
      j.status === "ready" || j.status === "failed" || j.status === "cancelled"
  ).length
  const failed = jobs.filter((j) => j.status === "failed").length
  const allDone = jobs.length > 0 && finished === jobs.length

  // Auto-collapse a few seconds after the batch finishes (unless the user
  // has explicitly toggled the tray).
  React.useEffect(() => {
    if (!allDone) return
    if (userToggled) return
    const handle = window.setTimeout(() => setCollapsed(true), 5000)
    return () => window.clearTimeout(handle)
  }, [allDone, userToggled])

  if (jobs.length === 0) return null

  const active = jobs.length - finished
  const overallProgress =
    jobs.reduce((sum, j) => sum + j.progress, 0) / jobs.length

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-background shadow-lg transition-all",
        // Hide on small screens until expanded so the tray never blocks
        // form inputs on mobile
        "max-sm:right-2 max-sm:bottom-2"
      )}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <button
          type="button"
          onClick={() => {
            setCollapsed((c) => !c)
            setUserToggled(true)
          }}
          className="flex flex-1 items-center gap-2 text-left"
          aria-label={collapsed ? "Expand upload tray" : "Collapse upload tray"}
          aria-expanded={!collapsed}
        >
          <TrayHeaderIcon allDone={allDone} failed={failed > 0} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">
              {trayTitle({ active, finished, failed, total: jobs.length })}
            </p>
            {!allDone ? (
              <p className="truncate text-[11px] text-muted-foreground">
                {Math.round(overallProgress * 100)}% overall
              </p>
            ) : null}
          </div>
          <RiArrowDownSLine
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              collapsed && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss upload tray"
          onClick={clearFinished}
          disabled={!allDone}
          className="ml-1"
        >
          <RiCloseLine className="size-3" aria-hidden />
        </Button>
      </div>

      {!allDone ? (
        <Progress
          value={overallProgress * 100}
          aria-label="Total upload progress"
          className="h-0.5 rounded-none"
        />
      ) : null}

      {!collapsed ? (
        <ul className="max-h-[280px] divide-y overflow-y-auto">
          {jobs.map((job) => (
            <UploadRow key={job.id} job={job} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function trayTitle({
  active,
  finished,
  failed,
  total,
}: {
  active: number
  finished: number
  failed: number
  total: number
}) {
  if (active > 0) {
    return `Uploading ${finished + 1} of ${total}…`
  }
  if (failed > 0) {
    const ok = total - failed
    return `${ok} done · ${failed} failed`
  }
  return `${total} ${total === 1 ? "file" : "files"} uploaded`
}

function TrayHeaderIcon({
  allDone,
  failed,
}: {
  allDone: boolean
  failed: boolean
}) {
  if (!allDone) {
    return (
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
      >
        <RiUploadCloud2Line className="size-3.5" />
      </span>
    )
  }
  if (failed) {
    return (
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive"
      >
        <RiErrorWarningLine className="size-3.5" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    >
      <RiCheckLine className="size-3.5" />
    </span>
  )
}

function UploadRow({ job }: { job: UploadJob }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        aria-hidden
        className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border bg-muted"
      >
        <FileTypeIcon mime={job.file.type} filename={job.file.name} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className="truncate text-sm font-medium leading-tight"
            title={job.file.name}
          >
            {job.file.name}
          </p>
          <StatusPill status={job.status} />
        </div>

        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {progressLabel(job)}
        </p>

        {job.error ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-destructive">
            {job.error}
          </p>
        ) : null}

        {(job.status === "uploading" || job.status === "processing") && (
          <Progress
            value={job.status === "processing" ? 100 : job.progress * 100}
            className={cn(
              "mt-2 h-1",
              job.status === "processing" && "[&>div]:animate-pulse"
            )}
          />
        )}
      </div>
    </li>
  )
}

function progressLabel(job: UploadJob): string {
  if (job.status === "uploading") {
    return `${formatBytes(job.bytesUploaded)} of ${formatBytes(job.bytesTotal)} · ${Math.round(job.progress * 100)}%`
  }
  if (job.status === "processing") {
    return "Generating thumbnail…"
  }
  if (job.status === "ready") {
    return `Completed · ${formatBytes(job.bytesTotal)}`
  }
  if (job.status === "queued") {
    return `Waiting · ${formatBytes(job.bytesTotal)}`
  }
  if (job.status === "cancelled") {
    return "Cancelled"
  }
  return formatBytes(job.bytesTotal)
}

function StatusPill({ status }: { status: UploadStatus }) {
  const variants: Record<
    UploadStatus,
    {
      label: string
      className: string
      Icon: React.ComponentType<{ className?: string }>
    }
  > = {
    queued: {
      label: "Queued",
      className: "bg-muted text-muted-foreground",
      Icon: RiTimeLine,
    },
    uploading: {
      label: "Uploading",
      className: "bg-primary/10 text-primary",
      Icon: RiLoader4Line,
    },
    processing: {
      label: "Processing",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      Icon: RiLoader4Line,
    },
    ready: {
      label: "Done",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      Icon: RiCheckLine,
    },
    failed: {
      label: "Failed",
      className: "bg-destructive/10 text-destructive",
      Icon: RiErrorWarningLine,
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-muted text-muted-foreground",
      Icon: RiCloseLine,
    },
  }
  const v = variants[status]
  const animate =
    status === "uploading" || status === "processing" ? "animate-spin" : ""
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap uppercase",
        v.className
      )}
    >
      <v.Icon className={cn("size-2.5", animate)} aria-hidden />
      {v.label}
    </span>
  )
}
