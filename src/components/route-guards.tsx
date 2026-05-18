import * as React from "react"
import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/hooks/useAuth"

function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div
        className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        role="status"
        aria-label="Loading"
      />
    </div>
  )
}

/** Renders children only when an authenticated session exists. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}

/** Sends already-authenticated users to /dashboard. */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
