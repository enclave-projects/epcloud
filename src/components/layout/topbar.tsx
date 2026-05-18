import * as React from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  RiMenuLine,
  RiNotification3Line,
  RiQuestionLine,
  RiSearchLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { UserMenu } from "./user-menu"

type TopbarProps = {
  onOpenMobileNav: () => void
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [value, setValue] = React.useState(params.get("q") ?? "")

  // Debounce search → navigate to /dashboard/files?q=...
  React.useEffect(() => {
    const trimmed = value.trim()
    if (trimmed.length === 0) return
    const handle = window.setTimeout(() => {
      navigate(`/dashboard/files?q=${encodeURIComponent(trimmed)}`)
    }, 300)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onOpenMobileNav}
        className="lg:hidden"
        aria-label="Open menu"
      >
        <RiMenuLine className="size-5" aria-hidden />
      </Button>

      <div className="relative max-w-md flex-1">
        <RiSearchLine
          aria-hidden
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder="Search files…"
          aria-label="Search files"
          className="pl-9"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Help"
              className="hidden sm:inline-flex"
            >
              <RiQuestionLine className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Help &amp; docs</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Notifications"
              className="hidden sm:inline-flex"
            >
              <RiNotification3Line className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-2 hidden h-6 sm:block" />

        <UserMenu />
      </div>
    </header>
  )
}
