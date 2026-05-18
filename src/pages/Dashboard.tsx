import * as React from "react"
import { Link } from "react-router-dom"
import { RiUploadCloud2Line } from "@remixicon/react"

import { DropZoneButton } from "@/components/dashboard/drop-zone"
import { MediaTable } from "@/components/dashboard/media-table"
import { PageHeader } from "@/components/dashboard/page-header"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentsRail } from "@/components/dashboard/recents"
import { ShareDialog } from "@/components/dashboard/share-dialog"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { Button } from "@/components/ui/button"
import { useUploads } from "@/hooks/use-uploads"
import { useMediaList, useMediaRealtimeCounter } from "@/hooks/use-media"
import { useAuth } from "@/hooks/useAuth"
import type { MediaRow } from "@/lib/media"

export default function DashboardPage() {
  const { user } = useAuth()
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? null
  const firstName = fullName?.split(/\s+/)[0]
  const [shareTarget, setShareTarget] = React.useState<MediaRow | MediaRow[] | null>(null)

  const realtimeKey = useMediaRealtimeCounter(user?.id)
  const { changeCounter } = useUploads()
  const { rows, loading } = useMediaList(
    {
      limit: 12,
      orderBy: "created_at",
      orderDir: "desc",
    },
    realtimeKey + changeCounter
  )

  return (
    <DashboardShell>
      <div className="space-y-8">
        <PageHeader
          title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          subtitle="Upload media and share it anywhere with secure, signed links."
          crumbs={[{ label: "Home" }]}
          actions={<HeaderUploadButton />}
        />

        <QuickActions />

        <RecentsRail rows={rows.slice(0, 4)} loading={loading} />

        <section aria-labelledby="files-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="files-heading"
              className="text-sm font-semibold tracking-tight"
            >
              All files
            </h2>
            <Button asChild variant="link" size="sm" className="text-xs">
              <Link to="/dashboard/files">See all</Link>
            </Button>
          </div>
          <MediaTable
            rows={rows}
            loading={loading}
            selectable
            onShare={setShareTarget}
            onChanged={() => undefined /* realtime handles it */}
            emptyState={<DropZoneButton />}
          />
        </section>
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

/**
 * Header "Upload" button — opens a hidden file picker that feeds into the
 * shared upload provider.
 */
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
