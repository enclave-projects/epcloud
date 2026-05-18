import * as React from "react"
import { Link } from "react-router-dom"
import {
  RiCheckLine,
  RiKey2Line,
  RiMailCheckLine,
  RiNotification3Line,
  RiUser3Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { PageHeader } from "@/components/dashboard/page-header"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import {
  getPreferences,
  updatePreferences,
  updateProfileName,
  type Preferences,
} from "@/lib/preferences"
import { FULL_NAME_MAX } from "@/lib/validators"

function initialsFor(value: string | undefined): string {
  if (!value) return "?"
  const trimmed = value.trim()
  if (trimmed.includes(" ")) {
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export default function SettingsPage() {
  const { user } = useAuth()
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? ""
  const email = user?.email ?? ""
  const isVerified = Boolean(user?.email_confirmed_at)

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          subtitle="Manage your account, security, and notification preferences."
          crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Settings" }]}
        />

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <RiUser3Line className="size-4" aria-hidden />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security">
              <RiKey2Line className="size-4" aria-hidden />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <RiNotification3Line className="size-4" aria-hidden />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab
              key={fullName}
              userId={user?.id}
              email={email}
              fullName={fullName}
              isVerified={isVerified}
            />
          </TabsContent>

          <TabsContent value="security">
            <SecurityTab email={email} />
          </TabsContent>

          <TabsContent value="notifications">
            {user ? <NotificationsTab userId={user.id} /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  )
}

function ProfileTab({
  userId,
  email,
  fullName,
  isVerified,
}: {
  userId: string | undefined
  email: string
  fullName: string
  isVerified: boolean
}) {
  const [name, setName] = React.useState(fullName)
  const [saving, setSaving] = React.useState(false)
  const dirty = name.trim() !== fullName.trim()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    try {
      await updateProfileName(userId, name)
      toast.success("Profile saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Personal information</CardTitle>
          <CardDescription>
            How your name appears on shared links and across EP Cloud.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                  {initialsFor(name || email)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <Button type="button" variant="outline" size="sm" disabled>
                  Change avatar
                </Button>
                <p className="text-xs text-muted-foreground">
                  Avatar uploads coming soon.
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="settings-name">Full name</Label>
              <Input
                id="settings-name"
                type="text"
                autoComplete="name"
                maxLength={FULL_NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="settings-email">Email</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="settings-email"
                  type="email"
                  value={email}
                  disabled
                  readOnly
                />
                {isVerified ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 whitespace-nowrap"
                  >
                    <RiMailCheckLine
                      className="size-3 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!dirty || saving}
                onClick={() => setName(fullName)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!dirty || saving}>
                <RiCheckLine className="size-4" aria-hidden />
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Subscription and account-wide actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-sm font-medium">Preview</p>
            <p className="mt-1 text-xs text-muted-foreground">
              5 GB of storage during preview. Paid plans coming soon.
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-full" disabled>
            Manage subscription
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled
          >
            Delete account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function SecurityTab({ email }: { email: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>
            Use a strong, unique password. Resets are sent via email OTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Last changed: <span className="font-medium">unknown</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={`/forgot-password?email=${encodeURIComponent(email)}`}>
              Send password reset code
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security with an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Authenticator app</p>
              <p className="text-xs text-muted-foreground">
                TOTP via Google Authenticator, 1Password, etc.
              </p>
            </div>
            <Switch disabled aria-label="Authenticator app 2FA" />
          </div>
          <p className="text-xs text-muted-foreground">
            Two-factor support is coming soon.
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Active sessions</CardTitle>
          <CardDescription>
            Devices currently signed in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">This device</p>
              <p className="text-xs text-muted-foreground">
                Signed in just now · current session
              </p>
            </div>
            <Badge variant="secondary">Current</Badge>
          </div>
          <Button variant="outline" size="sm" className="mt-3" disabled>
            Sign out all other sessions
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function NotificationsTab({ userId }: { userId: string }) {
  const [prefs, setPrefs] = React.useState<Preferences | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch
    setLoading(true)
    getPreferences(userId)
      .then((p) => {
        if (!cancelled) setPrefs(p)
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load preferences")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const toggle = async (
    field:
      | "notify_share_activity"
      | "notify_storage_warnings"
      | "notify_product_updates",
    value: boolean
  ) => {
    if (!prefs) return
    const previous = prefs
    setPrefs({ ...prefs, [field]: value })
    try {
      const next = await updatePreferences(userId, { [field]: value })
      setPrefs(next)
    } catch {
      setPrefs(previous)
      toast.error("Couldn't save preference")
    }
  }

  if (loading || !prefs) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email notifications</CardTitle>
        <CardDescription>
          Choose which transactional emails EP Cloud sends you.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <NotificationRow
          title="Security alerts"
          description="New sign-ins, password changes, and suspicious activity."
          checked={prefs.notify_security}
          required
          onChange={() => undefined}
        />
        <NotificationRow
          title="Share activity"
          description="When someone views or downloads a file via your signed links."
          checked={prefs.notify_share_activity}
          onChange={(v) => toggle("notify_share_activity", v)}
        />
        <NotificationRow
          title="Storage warnings"
          description="When you're close to your storage limit."
          checked={prefs.notify_storage_warnings}
          onChange={(v) => toggle("notify_storage_warnings", v)}
        />
        <NotificationRow
          title="Product updates"
          description="Occasional emails about new features and tips."
          checked={prefs.notify_product_updates}
          onChange={(v) => toggle("notify_product_updates", v)}
        />
      </CardContent>
    </Card>
  )
}

function NotificationRow({
  title,
  description,
  checked,
  required = false,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  required?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          {title}
          {required ? (
            <Badge variant="outline" className="ml-2 align-middle text-[10px]">
              Required
            </Badge>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={required ? true : checked}
        onCheckedChange={(v) => !required && onChange(v)}
        disabled={required}
        aria-label={title}
      />
    </div>
  )
}
