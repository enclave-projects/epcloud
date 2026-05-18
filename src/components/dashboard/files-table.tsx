import { RiCloudOffLine, RiUploadCloud2Line } from "@remixicon/react"

import { Button } from "@/components/ui/button"

/**
 * Empty state for the file list. Real table comes in the storage milestone.
 */
export function FilesTable() {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {/* Header */}
      <div className="hidden grid-cols-12 gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid">
        <div className="col-span-6">Name</div>
        <div className="col-span-2">Size</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2">Modified</div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"
        >
          <RiCloudOffLine className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">No files yet</p>
          <p className="text-xs text-muted-foreground">
            Upload your first image or video to start sharing with signed
            links.
          </p>
        </div>
        <Button size="sm" className="mt-2">
          <RiUploadCloud2Line className="size-4" aria-hidden />
          Upload your first file
        </Button>
      </div>
    </div>
  )
}
