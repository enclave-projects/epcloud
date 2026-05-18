import {
  RiShareLine,
  RiUploadCloud2Line,
  RiUserSharedLine,
} from "@remixicon/react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export default function SharedPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title="Shared"
          subtitle="Files you've shared with others, and ones shared with you."
          crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Shared" }]}
        />

        <Tabs defaultValue="by-me" className="space-y-4">
          <TabsList>
            <TabsTrigger value="by-me">Shared by me</TabsTrigger>
            <TabsTrigger value="with-me">Shared with me</TabsTrigger>
          </TabsList>

          <TabsContent value="by-me" className="mt-0">
            <EmptyState
              icon={RiShareLine}
              title="You haven't shared anything yet"
              description="Generate a signed link from any file to share it with anyone — no account required for the recipient."
              accent="bg-primary/10 text-primary"
              action={
                <Button size="sm">
                  <RiUploadCloud2Line className="size-4" aria-hidden />
                  Upload to share
                </Button>
              }
            />
          </TabsContent>

          <TabsContent value="with-me" className="mt-0">
            <EmptyState
              icon={RiUserSharedLine}
              title="Nothing shared with you"
              description="When teammates share files via EP Cloud, they'll appear here. Team sharing is coming soon."
              accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  )
}
