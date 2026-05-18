import * as React from "react"

import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { GlobalDropZone } from "@/components/dashboard/drop-zone"
import { UploadTray } from "@/components/dashboard/upload-tray"

type DashboardShellProps = {
  children: React.ReactNode
}

/**
 * Dropbox-style three-zone layout. UploadProvider is intentionally NOT
 * mounted here — it lives one level up (in App) so page-level hooks like
 * `useUploads()` work even before this shell renders.
 */
export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <GlobalDropZone>
      <div className="min-h-svh bg-muted/30">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <div className="lg:pl-[260px]">
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
      <UploadTray />
    </GlobalDropZone>
  )
}
