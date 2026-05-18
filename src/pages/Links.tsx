import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import {
  RiCloseCircleLine,
  RiDeleteBinLine,
  RiLink,
  RiShieldCheckLine,
  RiTimeLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  deleteShareLink,
  listShareLinks,
  revokeShareLink,
} from "@/lib/shares"
import type { Database } from "@/types/database"

type ShareLinkRow = Database["public"]["Tables"]["share_links"]["Row"]

const FEATURE_HIGHLIGHTS = [
  {
    icon: RiShieldCheckLine,
    title: "Encrypted, signed URLs",
    description:
      "Tokens are 32 bytes of crypto-random data. We store only sha256(token) — tampering breaks the link.",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: RiTimeLine,
    title: "Expiry & view limits",
    description:
      "Links can expire after a set time, a number of views, or both. Optional bcrypt password too.",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: RiLink,
    title: "Embed anywhere",
    description:
      "Drop the URL into Markdown, an <img>/<video> tag, or paste the iframe — origin allowlist is yours to set.",
    accent: "bg-primary/10 text-primary",
  },
]

export default function LinksPage() {
  const [links, setLinks] = React.useState<ShareLinkRow[] | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await listShareLinks()
      setLinks(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load links")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch
    void load()
  }, [load])

  const handleRevoke = async (id: string) => {
    if (!window.confirm("Revoke this link? It'll stop working immediately.")) return
    try {
      await revokeShareLink(id)
      toast.success("Revoked")
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke")
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this link record? This can't be undone.")) return
    try {
      await deleteShareLink(id)
      toast.success("Deleted")
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <PageHeader
          title="Signed links"
          subtitle="Manage every shareable URL you've generated for your media."
          crumbs={[
            { label: "Home", href: "/dashboard" },
            { label: "Signed links" },
          ]}
        />

        <section className="grid gap-3 sm:grid-cols-3">
          {FEATURE_HIGHLIGHTS.map((feat) => (
            <Card key={feat.title} className="border-muted">
              <CardHeader className="space-y-3">
                <span
                  aria-hidden
                  className={`grid size-9 place-items-center rounded-md ${feat.accent}`}
                >
                  <feat.icon className="size-4" />
                </span>
                <CardTitle className="text-sm font-semibold">
                  {feat.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {feat.description}
              </CardContent>
            </Card>
          ))}
        </section>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !links || links.length === 0 ? (
          <EmptyState
            icon={RiLink}
            title="No signed links yet"
            description="Open any file's menu and choose Share to mint a signed link with an expiry of your choice."
            accent="bg-primary/10 text-primary"
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Settings</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      <LinkStatus link={link} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(link.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {link.expires_at
                        ? formatDistanceToNow(new Date(link.expires_at), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {link.view_count}
                      {link.max_views ? ` / ${link.max_views}` : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {link.password_hash ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Password
                          </Badge>
                        ) : null}
                        {link.allowed_origins ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Origin allowlist
                          </Badge>
                        ) : null}
                        {link.allow_download ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Downloadable
                          </Badge>
                        ) : null}
                        {!link.allow_embed ? (
                          <Badge variant="outline" className="text-[10px]">
                            No embed
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!link.revoked_at ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Revoke"
                            onClick={() => handleRevoke(link.id)}
                          >
                            <RiCloseCircleLine
                              className="size-4"
                              aria-hidden
                            />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete"
                          onClick={() => handleDelete(link.id)}
                        >
                          <RiDeleteBinLine className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}

function LinkStatus({ link }: { link: ShareLinkRow }) {
  if (link.revoked_at) {
    return <Badge variant="destructive">Revoked</Badge>
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return <Badge variant="outline">Expired</Badge>
  }
  if (link.max_views && link.view_count >= link.max_views) {
    return <Badge variant="outline">Used up</Badge>
  }
  return <Badge variant="secondary">Active</Badge>
}
