import * as React from "react"

import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
  className?: string
  /** Tailwind classes applied to the icon chip background */
  accent?: string
}

/**
 * Friendly, consistent empty state shared across feature pages.
 * Matches the look of FilesTable's empty state.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  accent = "bg-muted text-muted-foreground",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-lg border bg-background px-4 py-16 text-center",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-12 place-items-center rounded-full",
          accent
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
