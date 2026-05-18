import * as React from "react"

import { UploadProvider } from "@/hooks/use-uploads"
import { useAuth } from "@/hooks/useAuth"

/**
 * Wraps the authenticated dashboard tree with an UploadProvider scoped to
 * the current user. Lives at the route level so page components can safely
 * call `useUploads()` from anywhere within the dashboard.
 */
export function AuthUploadGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (
    <UploadProvider ownerId={user?.id ?? null}>{children}</UploadProvider>
  )
}
