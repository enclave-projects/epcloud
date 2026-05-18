import {
  RiFolderAddLine,
  RiImageAddLine,
  RiLink,
  RiVideoAddLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"

type ActionTile = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  accent: string
}

/**
 * Quick-action shortcuts. The primary "Upload" CTA lives in the page header
 * — these tiles cover specific workflows users want one click for.
 */
const TILES: ActionTile[] = [
  {
    icon: RiImageAddLine,
    title: "Upload images",
    description: "JPG, PNG, WebP, AVIF, HEIC",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: RiVideoAddLine,
    title: "Upload videos",
    description: "MP4, WebM, MOV — up to 2 GB",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: RiFolderAddLine,
    title: "New folder",
    description: "Organize your media",
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    icon: RiLink,
    title: "Create signed link",
    description: "Share any file with an expiring URL",
    accent: "bg-primary/10 text-primary",
  },
]

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TILES.map((tile) => (
        <button
          key={tile.title}
          type="button"
          className={cn(
            "group flex items-start gap-3 rounded-lg border bg-background p-4 text-left transition-all",
            "hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-md transition-transform group-hover:scale-105",
              tile.accent
            )}
          >
            <tile.icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{tile.title}</span>
            <span className="block text-xs text-muted-foreground">
              {tile.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
