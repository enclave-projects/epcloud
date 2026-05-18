import { Navigate, Route, Routes } from "react-router-dom"

import { AuthUploadGate } from "@/components/auth-upload-gate"
import {
  RedirectIfAuthed,
  RequireAuth,
} from "@/components/route-guards"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import LoginPage from "@/pages/Login"
import RegisterPage from "@/pages/Register"
import DashboardPage from "@/pages/Dashboard"
import FilesPage from "@/pages/Files"
import MediaPage from "@/pages/Media"
import RecentPage from "@/pages/Recent"
import SharedPage from "@/pages/Shared"
import LinksPage from "@/pages/Links"
import TrashPage from "@/pages/Trash"
import SettingsPage from "@/pages/Settings"
import VerifyEmailPage from "@/pages/VerifyEmail"
import ForgotPasswordPage from "@/pages/ForgotPassword"
import ResetPasswordPage from "@/pages/ResetPassword"
import ViewerPage from "@/pages/Viewer"

/**
 * Wraps every authenticated dashboard page with the auth guard AND the
 * UploadProvider so page-level `useUploads()` calls work safely.
 */
function ProtectedDashboardRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AuthUploadGate>{children}</AuthUploadGate>
    </RequireAuth>
  )
}

export function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Public share routes — no auth required */}
        <Route path="/v/:token" element={<ViewerPage mode="view" />} />
        <Route path="/e/:token" element={<ViewerPage mode="embed" />} />

        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthed>
              <RegisterPage />
            </RedirectIfAuthed>
          }
        />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/forgot-password"
          element={
            <RedirectIfAuthed>
              <ForgotPasswordPage />
            </RedirectIfAuthed>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Authenticated dashboard area */}
        <Route
          path="/dashboard"
          element={
            <ProtectedDashboardRoute>
              <DashboardPage />
            </ProtectedDashboardRoute>
          }
        />
        <Route
          path="/dashboard/files"
          element={
            <ProtectedDashboardRoute>
              <FilesPage />
            </ProtectedDashboardRoute>
          }
        />
        <Route
          path="/dashboard/media"
          element={
            <ProtectedDashboardRoute>
              <MediaPage />
            </ProtectedDashboardRoute>
          }
        />
        <Route
          path="/dashboard/recent"
          element={
            <ProtectedDashboardRoute>
              <RecentPage />
            </ProtectedDashboardRoute>
          }
        />
        <Route
          path="/dashboard/shared"
          element={
            <ProtectedDashboardRoute>
              <SharedPage />
            </ProtectedDashboardRoute>
          }
        />
        <Route
          path="/dashboard/links"
          element={
            <ProtectedDashboardRoute>
              <LinksPage />
            </ProtectedDashboardRoute>
          }
        />
        <Route
          path="/dashboard/trash"
          element={
            <ProtectedDashboardRoute>
              <TrashPage />
            </ProtectedDashboardRoute>
          }
        />
        <Route
          path="/dashboard/settings"
          element={
            <ProtectedDashboardRoute>
              <SettingsPage />
            </ProtectedDashboardRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  )
}

export default App
