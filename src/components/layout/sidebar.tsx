import * as React from "react"
import { NavLink } from "react-router-dom"
import {
  RiCloseLine,
  RiDashboardLine,
  RiDeleteBinLine,
  RiFileImageLine,
  RiFolderLine,
  RiLink,
  RiSettings3Line,
  RiShareLine,
  RiTimeLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { StorageMeter } from "./storage-meter"

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: RiDashboardLine },
  { to: "/dashboard/files", label: "All files", icon: RiFolderLine },
  { to: "/dashboard/media", label: "Media", icon: RiFileImageLine },
  { to: "/dashboard/recent", label: "Recent", icon: RiTimeLine },
  { to: "/dashboard/shared", label: "Shared", icon: RiShareLine },
  { to: "/dashboard/links", label: "Signed links", icon: RiLink },
  { to: "/dashboard/trash", label: "Trash", icon: RiDeleteBinLine },
]

const FOOTER_ITEMS: NavItem[] = [
  { to: "/dashboard/settings", label: "Settings", icon: RiSettings3Line },
]

type SidebarProps = {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden
        onClick={onMobileClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      />

      <aside
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r bg-background transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b px-5">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-2"
            onClick={onMobileClose}
          >
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
            >
              EP
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">
              EP Cloud
            </span>
          </NavLink>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMobileClose}
            className="lg:hidden"
            aria-label="Close menu"
          >
            <RiCloseLine className="size-4" aria-hidden />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavItemLink item={item} onNavigate={onMobileClose} />
              </li>
            ))}
          </ul>

          <div className="mt-6 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Account
          </div>
          <ul className="mt-2 space-y-0.5">
            {FOOTER_ITEMS.map((item) => (
              <li key={item.to}>
                <NavItemLink item={item} onNavigate={onMobileClose} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Storage meter */}
        <div className="border-t p-4">
          <StorageMeter />
        </div>
      </aside>
    </>
  )
}

function NavItemLink({
  item,
  onNavigate,
}: {
  item: NavItem
  onNavigate: () => void
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === "/dashboard"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/70 hover:bg-muted hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "size-4 shrink-0",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            aria-hidden
          />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}
