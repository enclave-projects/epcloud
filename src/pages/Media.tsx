import * as React from "react"
import {
  RiFileImageLine,
  RiVideoLine,
} from "@remixicon/react"

import { DropZoneButton } from "@/components/dashboard/drop-zone"
import { EmptyState } from "@/components/dashboard/empty-state"
import { MediaTable } from "@/components/dashboard/media-table"
import { PageHeader } from "@/components/dashboard/page-header"
import { ShareDialog } from "@/components/dashboard/share-dialog"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import { useMediaList, useMediaRealtimeCounter } from "@/hooks/use-media"
import { useUploads } from "@/hooks/use-uploads"
import type { MediaKind, MediaRow } from "@/lib/media"

export default function MediaPage() {
  const { user } = useAuth()
  const [shareTarget, setShareTarget] = React.useState<MediaRow | MediaRow[] | null>(null)
  const realtimeKey = useMediaRealtimeCounter(user?.id)

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title="Media"
          subtitle="Browse images and videos you've uploaded."
          crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Media" }]}
        />

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <KindTab
              kind="all"
              realtimeKey={realtimeKey}
              ownerId={user?.id}
              setShareTarget={setShareTarget}
              empty={<DropZoneButton />}
            />
          </TabsContent>
          <TabsContent value="images">
            <KindTab
              kind="image"
              realtimeKey={realtimeKey}
              ownerId={user?.id}
              setShareTarget={setShareTarget}
              empty={
                <EmptyState
                  icon={RiFileImageLine}
                  title="No images yet"
                  description="Supported formats: JPG, PNG, WebP, AVIF, HEIC. Up to 50 MB per image."
                  accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                />
              }
            />
          </TabsContent>
          <TabsContent value="videos">
            <KindTab
              kind="video"
              realtimeKey={realtimeKey}
              ownerId={user?.id}
              setShareTarget={setShareTarget}
              empty={
                <EmptyState
                  icon={RiVideoLine}
                  title="No videos yet"
                  description="Supported formats: MP4, WebM, MOV. Up to 2 GB per video."
                  accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                />
              }
            />
          </TabsContent>
        </Tabs>
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

function KindTab({
  kind,
  realtimeKey,
  setShareTarget,
  empty,
}: {
  kind: MediaKind | "all"
  realtimeKey: number
  ownerId: string | undefined
  setShareTarget: (m: MediaRow | MediaRow[]) => void
  empty: React.ReactNode
}) {
  const { changeCounter } = useUploads()
  const { rows, loading } = useMediaList(
    { kind, limit: 100 },
    realtimeKey + changeCounter
  )
  return (
    <MediaTable
      rows={rows}
      loading={loading}
      selectable
      onShare={setShareTarget}
      onChanged={() => undefined}
      emptyState={empty}
    />
  )
}
