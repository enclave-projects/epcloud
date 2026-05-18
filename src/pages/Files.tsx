import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { RiCloudOffLine, RiUploadCloud2Line } from "@remixicon/react"

import { DropZoneButton } from "@/components/dashboard/drop-zone"
import { EmptyState } from "@/components/dashboard/empty-state"
import { MediaTable } from "@/components/dashboard/media-table"
import { PageHeader } from "@/components/dashboard/page-header"
import { ShareDialog } from "@/components/dashboard/share-dialog"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { Button } from "@/components/ui/button"
import { useUploads } from "@/hooks/use-uploads"
import { useMediaList, useMediaRealtimeCounter } from "@/hooks/use-media"
import { useAuth } from "@/hooks/useAuth"
import type { MediaRow } from "@/lib/media"

export default function FilesPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const search = params.get("q") ?? ""

  const realtimeKey = useMediaRealtimeCounter(user?.id)
  const { changeCounter } = useUploads()
  const { rows, loading } = useMediaList(
    { limit: 100, search: search || undefined },
    realtimeKey + changeCounter
  )

  const [shareTarget, setShareTarget] = React.useState<MediaRow | MediaRow[] | null>(null)

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={search ? `Results for "${search}"` : "All files"}
          subtitle={
            search
              ? `${rows.length} match${rows.length === 1 ? "" : "es"}.`
              : "Everything you've uploaded, in one place."
          }
          crumbs={[
            { label: "Home", href: "/dashboard" },
            { label: "All files" },
          ]}
          actions={<HeaderUploadButton />}
        />

        <MediaTable
          rows={rows}
          loading={loading}
          selectable
          onShare={setShareTarget}
          onChanged={() => undefined}
          emptyState={
            search ? (
              <EmptyState
                icon={RiCloudOffLine}
                title="No files match your search"
                description="Try a different filename or remove filters."
              />
            ) : (
              <DropZoneButton />
            )
          }
        />
      </div>

      {shareTarget && user ? (
        <ShareDialog
          media={Array.isArray(shareTarget) ? shareTarget[0] : shareTarget}
          ownerId={user.id}
          onClose={() => setShareTarget(null)}
        />
      ) : null}
    </DashboardShell>
  )
}

function HeaderUploadButton() {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { start } = useUploads()
  return (
    <>
      <Button size="sm" onClick={() => inputRef.current?.click()}>
        <RiUploadCloud2Line className="size-4" aria-hidden />
        Upload
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            void start(e.target.files)
            e.target.value = ""
          }
        }}
      />
    </>
  )
}
