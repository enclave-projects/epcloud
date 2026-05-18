import { useNavigate } from "react-router-dom"
import {
  RiLogoutBoxRLine,
  RiSettings3Line,
  RiUser3Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/useAuth"
import { logout } from "@/lib/auth"

function initialsFor(nameOrEmail: string | undefined): string {
  if (!nameOrEmail) return "?"
  const trimmed = nameOrEmail.trim()
  if (trimmed.includes(" ")) {
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? null
  const email = user?.email ?? ""
  const initials = initialsFor(fullName ?? email)

  const handleSignOut = async () => {
    await logout()
    toast.success("Signed out")
    navigate("/login", { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Open user menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {fullName ?? "Account"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/dashboard/settings")}>
          <RiUser3Line className="size-4" aria-hidden />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/dashboard/settings")}>
          <RiSettings3Line className="size-4" aria-hidden />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} variant="destructive">
          <RiLogoutBoxRLine className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
