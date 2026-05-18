import * as React from "react"
import { RiTimeLine } from "@remixicon/react"

import { DropZoneButton } from "@/components/dashboard/drop-zone"
import { EmptyState } from "@/components/dashboard/empty-state"
import { MediaTable } from "@/components/dashboard/media-table"
import { PageHeader } from "@/components/dashboard/page-header"
import { ShareDialog } from "@/components/dashboard/share-dialog"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { useAuth } from "@/hooks/useAuth"
import { useMediaList, useMediaRealtimeCounter } from "@/hooks/use-media"
import { useUploads } from "@/hooks/use-uploads"
import type { MediaRow } from "@/lib/media"

export default function RecentPage() {
  const { user } = useAuth()
  const realtimeKey = useMediaRealtimeCounter(user?.id)
  const { changeCounter } = useUploads()
  const { rows, loading } = useMediaList(
    { recentDays: 30, limit: 100 },
    realtimeKey + changeCounter
  )
  const [shareTarget, setShareTarget] = React.useState<MediaRow | MediaRow[] | null>(null)

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title="Recent"
          subtitle="Files uploaded in the last 30 days."
          crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Recent" }]}
        />

        <MediaTable
          rows={rows}
          loading={loading}
          selectable
          onShare={setShareTarget}
          onChanged={() => undefined}
          emptyState={
            <EmptyState
              icon={RiTimeLine}
              title="Nothing recent yet"
              description="As soon as you upload, view, or share a file, it'll appear here."
              action={<DropZoneButton />}
            />
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
