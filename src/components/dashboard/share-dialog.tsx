import * as React from "react"
import { RiClipboardLine, RiCodeLine, RiLinkM } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createShareLink, type ShareLinkSettings } from "@/lib/shares"
import type { MediaRow } from "@/lib/media"

const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
  { label: "Never", hours: null },
] as const

export function ShareDialog({
  media,
  ownerId,
  onClose,
}: {
  media: MediaRow
  ownerId: string
  onClose: () => void
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const [link, setLink] = React.useState<{
    url: string
    embedUrl: string
    token: string
  } | null>(null)

  // Form state
  const [expiryHours, setExpiryHours] = React.useState<number | null>(24 * 7)
  const [maxViews, setMaxViews] = React.useState<string>("")
  const [password, setPassword] = React.useState("")
  const [allowedOrigins, setAllowedOrigins] = React.useState("")
  const [allowDownload, setAllowDownload] = React.useState(false)
  const [allowEmbed, setAllowEmbed] = React.useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const settings: ShareLinkSettings = {
        expiresAt:
          expiryHours === null
            ? null
            : new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        maxViews: maxViews ? Math.max(1, parseInt(maxViews, 10) || 0) : null,
        password: password || null,
        allowedOrigins: allowedOrigins.trim() || null,
        allowDownload,
        allowEmbed,
      }
      const result = await createShareLink(media.id, ownerId, settings)
      setLink(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Share file</DialogTitle>
          <DialogDescription className="truncate">
            Generate an encrypted, signed link for {media.original_filename}.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <CreatedLinkView link={link} onClose={onClose} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expiry">Link expires</Label>
                <Select
                  value={String(expiryHours)}
                  onValueChange={(v) =>
                    setExpiryHours(v === "null" ? null : Number(v))
                  }
                >
                  <SelectTrigger id="expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.label} value={String(opt.hours)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-views">Max views</Label>
                <Input
                  id="max-views"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder="Unlimited"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="text"
                autoComplete="off"
                maxLength={128}
                placeholder="Leave blank for no password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="origins">
                Allowed origins (comma-separated, optional)
              </Label>
              <Textarea
                id="origins"
                rows={2}
                placeholder="https://example.com, https://blog.example.com"
                value={allowedOrigins}
                onChange={(e) => setAllowedOrigins(e.target.value)}
                maxLength={2048}
              />
              <p className="text-xs text-muted-foreground">
                When set, the embed only renders if the host page's Origin
                matches one of these.
              </p>
            </div>

            <div className="space-y-2">
              <ToggleRow
                label="Allow download"
                description="Show a download button on the share page."
                value={allowDownload}
                onChange={setAllowDownload}
              />
              <ToggleRow
                label="Allow embedding"
                description="Permit the file to render inside an <iframe>."
                value={allowEmbed}
                onChange={setAllowEmbed}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating link…" : "Create link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}

function CreatedLinkView({
  link,
  onClose,
}: {
  link: { url: string; embedUrl: string; token: string }
  onClose: () => void
}) {
  const embedSnippet = `<iframe src="${link.embedUrl}" loading="lazy" allowfullscreen style="border:0;width:100%;aspect-ratio:16/9"></iframe>`

  const copy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Couldn't copy"))
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="link" className="space-y-4">
        <TabsList>
          <TabsTrigger value="link">
            <RiLinkM className="size-4" aria-hidden />
            Link
          </TabsTrigger>
          <TabsTrigger value="embed">
            <RiCodeLine className="size-4" aria-hidden />
            Embed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="space-y-2">
          <Label htmlFor="share-url">Share URL</Label>
          <div className="flex gap-2">
            <Input
              id="share-url"
              value={link.url}
              readOnly
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy URL"
              onClick={() => copy(link.url, "Link")}
            >
              <RiClipboardLine className="size-4" aria-hidden />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Click the field to select all, or use the copy button. We don't
            keep a copy of the secret token — copy it now.
          </p>
        </TabsContent>

        <TabsContent value="embed" className="space-y-2">
          <Label htmlFor="embed-snippet">HTML snippet</Label>
          <Textarea
            id="embed-snippet"
            rows={3}
            readOnly
            className="font-mono text-xs"
            value={embedSnippet}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copy(embedSnippet, "Embed code")}
          >
            <RiClipboardLine className="size-4" aria-hidden />
            Copy embed code
          </Button>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </div>
  )
}
