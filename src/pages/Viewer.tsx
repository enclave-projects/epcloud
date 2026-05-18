import * as React from "react"
import { useParams, useSearchParams } from "react-router-dom"
import {
  RiDownloadLine,
  RiErrorWarningLine,
  RiLockLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatBytes } from "@/lib/storage"
import { supabase } from "@/lib/supabase"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Resolve a share link by calling the DB RPC directly via PostgREST.
 * This bypasses the edge function entirely — no Docker hostname leak,
 * no memory/sandbox issues. The RPC mints signed storage URLs using
 * pgjwt and returns relative paths that we prepend with the public host.
 */
async function resolveShare(
  token: string,
  password: string | null
): Promise<ResolveResponse> {
  const enc = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest("SHA-256", enc)
  const tokenHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  const { data, error } = await supabase.rpc("resolve_share_public", {
    p_token_hash: tokenHash,
    p_password: password ?? null,
    p_origin: window.location.origin,
    p_ip_hash: null,
    p_user_agent: navigator.userAgent.slice(0, 256),
  })

  if (error) {
    console.error("resolve_share_public RPC error:", error)
    return { ok: false, outcome: "not_found" }
  }

  const result = data as {
    ok: boolean
    outcome?: string
    media?: Record<string, unknown>
  }
  if (!result || !result.ok) {
    return { ok: false, outcome: result?.outcome ?? "not_found" }
  }

  const m = result.media!
  return {
    ok: true,
    media: {
      mime_type: m.mime_type as string,
      kind: m.kind as "image" | "video" | "other",
      width: m.width as number | null,
      height: m.height as number | null,
      duration_seconds: m.duration_seconds as number | null,
      original_filename: m.original_filename as string,
      size_bytes: m.size_bytes as number,
      allow_download: m.allow_download as boolean,
      allow_embed: m.allow_embed as boolean,
      signed_url: `${SUPABASE_URL}${m.signed_url}`,
      thumbnail_url: m.thumbnail_url
        ? `${SUPABASE_URL}${m.thumbnail_url}`
        : null,
    },
  }
}

type ResolvedMedia = {
  mime_type: string
  kind: "image" | "video" | "other"
  width: number | null
  height: number | null
  duration_seconds: number | null
  original_filename: string
  size_bytes: number
  allow_download: boolean
  allow_embed: boolean
  signed_url: string
  thumbnail_url: string | null
}

type ResolveResponse =
  | { ok: true; media: ResolvedMedia }
  | { ok: false; outcome: string }

const OUTCOME_COPY: Record<string, { title: string; description: string }> = {
  not_found: {
    title: "Link not found",
    description: "This share link doesn't exist or has been deleted.",
  },
  expired: {
    title: "Link expired",
    description: "The owner set this link to expire and it has.",
  },
  revoked: {
    title: "Link revoked",
    description: "The owner has revoked this share link.",
  },
  view_limit: {
    title: "View limit reached",
    description: "This link has reached its view-count limit.",
  },
  invalid_password: {
    title: "Wrong password",
    description: "Try again, or ask the owner for the password.",
  },
  origin_denied: {
    title: "Embed not allowed here",
    description: "The owner restricted this link to specific websites.",
  },
  rate_limited: {
    title: "Too many attempts",
    description: "Please wait a minute and try again.",
  },
}

type Props = { mode?: "view" | "embed" }

export default function ViewerPage({ mode = "view" }: Props) {
  const { token = "" } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const presetPassword = searchParams.get("password") ?? ""

  const [password, setPassword] = React.useState(presetPassword)
  const [submitted, setSubmitted] = React.useState(
    presetPassword.length > 0 || true
  )
  const [loading, setLoading] = React.useState(true)
  const [media, setMedia] = React.useState<ResolvedMedia | null>(null)
  const [outcome, setOutcome] = React.useState<string | null>(null)

  // Effect performs the resolve fetch whenever (token, password, submitted)
  // changes. We intentionally drive setState here — this is the synchronize-
  // with-external-system pattern the rule allows.
  React.useEffect(() => {
    if (!submitted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setOutcome(null)

    resolveShare(token, password || null)
      .then((json) => {
        if (cancelled) return
        if (json.ok) {
          setMedia(json.media)
          setOutcome("success")
        } else {
          setOutcome(json.outcome ?? "not_found")
          setMedia(null)
        }
      })
      .catch(() => {
        if (!cancelled) setOutcome("not_found")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, password, submitted])

  const showPasswordPrompt =
    outcome === "invalid_password" || (!submitted && !media)

  const wrapper =
    mode === "embed"
      ? "min-h-svh flex items-center justify-center bg-black"
      : "min-h-svh bg-muted/30 flex flex-col items-center justify-center px-4 py-10"

  if (loading) {
    return (
      <div className={wrapper}>
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    )
  }

  if (showPasswordPrompt) {
    return (
      <div className={wrapper}>
        <PasswordPrompt
          onSubmit={(pw) => {
            setPassword(pw)
            setSubmitted(true)
          }}
          showError={outcome === "invalid_password"}
        />
      </div>
    )
  }

  if (!media || outcome !== "success") {
    return (
      <div className={wrapper}>
        <FailureCard outcome={outcome ?? "not_found"} />
      </div>
    )
  }

  if (mode === "embed") {
    if (!media.allow_embed) {
      return (
        <div className={wrapper}>
          <FailureCard outcome="origin_denied" />
        </div>
      )
    }
    return <EmbedView media={media} />
  }

  return (
    <div className={wrapper}>
      <ViewerCard media={media} />
    </div>
  )
}

function PasswordPrompt({
  onSubmit,
  showError,
}: {
  onSubmit: (pw: string) => void
  showError: boolean
}) {
  const [pw, setPw] = React.useState("")
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (pw.length > 0) onSubmit(pw)
      }}
      className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"
        >
          <RiLockLine className="size-5" />
        </span>
        <div>
          <h1 className="text-base font-semibold">Password protected</h1>
          <p className="text-xs text-muted-foreground">
            Enter the password to view this file.
          </p>
        </div>
      </div>
      {showError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>That password isn't right.</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="share-password">Password</Label>
        <Input
          id="share-password"
          type="password"
          maxLength={128}
          autoComplete="off"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
      </div>
      <Button type="submit" className="w-full" disabled={pw.length === 0}>
        Unlock
      </Button>
    </form>
  )
}

function FailureCard({ outcome }: { outcome: string }) {
  const copy = OUTCOME_COPY[outcome] ?? OUTCOME_COPY.not_found
  return (
    <div className="w-full max-w-sm space-y-3 rounded-lg border bg-background p-6 text-center shadow-sm">
      <span
        aria-hidden
        className="mx-auto grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive"
      >
        <RiErrorWarningLine className="size-5" />
      </span>
      <h1 className="text-base font-semibold">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
    </div>
  )
}

function ViewerCard({ media }: { media: ResolvedMedia }) {
  return (
    <div className="w-full max-w-3xl space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {media.original_filename}
          </h1>
          <p className="text-xs text-muted-foreground">
            {media.kind} · {formatBytes(media.size_bytes)}
          </p>
        </div>
        {media.allow_download ? (
          <Button asChild size="sm">
            <a href={media.signed_url} download={media.original_filename}>
              <RiDownloadLine className="size-4" aria-hidden />
              Download
            </a>
          </Button>
        ) : null}
      </header>
      <div className="overflow-hidden rounded-lg border bg-background">
        <MediaPlayer media={media} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Shared via{" "}
        <a href="/" className="font-medium hover:underline">
          EP Cloud
        </a>
      </p>
    </div>
  )
}

function EmbedView({ media }: { media: ResolvedMedia }) {
  return (
    <div className="size-full">
      <MediaPlayer media={media} embed />
    </div>
  )
}

function MediaPlayer({
  media,
  embed = false,
}: {
  media: ResolvedMedia
  embed?: boolean
}) {
  if (media.kind === "image") {
    return (
      <img
        src={media.signed_url}
        alt={media.original_filename}
        loading="eager"
        decoding="async"
        className={
          embed
            ? "size-full object-contain"
            : "max-h-[80svh] w-full bg-muted object-contain"
        }
      />
    )
  }
  if (media.kind === "video") {
    return (
      <video
        src={media.signed_url}
        controls
        playsInline
        preload="metadata"
        className={
          embed
            ? "size-full bg-black object-contain"
            : "max-h-[80svh] w-full bg-black"
        }
      />
    )
  }
  // Generic file fallback
  return (
    <div className="space-y-3 px-6 py-10 text-center">
      <p className="text-sm font-medium">{media.original_filename}</p>
      <p className="text-xs text-muted-foreground">
        {formatBytes(media.size_bytes)}
      </p>
      <Button asChild size="sm">
        <a href={media.signed_url} target="_blank" rel="noreferrer">
          Open file
        </a>
      </Button>
    </div>
  )
}
