import { supabase } from "@/lib/supabase"
import { consumeRateLimit } from "@/lib/rate-limit"
import type { Database } from "@/types/database"

type ShareLinkRow = Database["public"]["Tables"]["share_links"]["Row"]

export type ShareLinkSettings = {
  expiresAt?: Date | null
  maxViews?: number | null
  password?: string | null
  allowedOrigins?: string | null
  allowDownload?: boolean
  allowEmbed?: boolean
}

const SHARE_CREATE_MAX = 30
const SHARE_CREATE_WINDOW_S = 60 * 60 // 30 new links per hour

function bytesToBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", enc)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export type CreatedShareLink = {
  id: string
  token: string                 // plaintext, shown ONCE
  url: string                   // ready-to-paste full URL
  embedUrl: string              // /e/<token> for iframes
  link: ShareLinkRow
}

/**
 * Mint a new share link. The plaintext token is returned once and never
 * stored. We persist only sha256(token).
 */
export async function createShareLink(
  mediaId: string,
  ownerId: string,
  settings: ShareLinkSettings = {}
): Promise<CreatedShareLink> {
  const allowed = await consumeRateLimit(
    `share-create:${ownerId}`,
    SHARE_CREATE_MAX,
    SHARE_CREATE_WINDOW_S
  )
  if (!allowed) {
    throw new Error(
      "Too many share links created recently. Please wait a few minutes."
    )
  }

  // 32 random bytes → base64url (43 chars). Cryptographically random.
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = bytesToBase64Url(tokenBytes)
  const tokenHash = await sha256Hex(token)

  // Hash password server-side via security-definer RPC (bcrypt).
  let passwordHash: string | null = null
  if (settings.password && settings.password.length > 0) {
    if (settings.password.length > 128) {
      throw new Error("Password is too long (max 128 chars).")
    }
    const { data, error } = await supabase.rpc("hash_share_password", {
      p_password: settings.password,
    })
    if (error) throw error
    passwordHash = data as string
  }

  const { data, error } = await supabase
    .from("share_links")
    .insert({
      media_id: mediaId,
      owner_id: ownerId,
      token_hash: tokenHash,
      password_hash: passwordHash,
      expires_at: settings.expiresAt ? settings.expiresAt.toISOString() : null,
      max_views: settings.maxViews ?? null,
      allowed_origins: settings.allowedOrigins ?? null,
      allow_download: settings.allowDownload ?? false,
      allow_embed: settings.allowEmbed ?? true,
    })
    .select()
    .single()

  if (error) throw error

  const origin = window.location.origin
  return {
    id: data.id,
    token,
    url: `${origin}/v/${token}`,
    embedUrl: `${origin}/e/${token}`,
    link: data,
  }
}

export async function listShareLinks(): Promise<ShareLinkRow[]> {
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listShareLinksForMedia(
  mediaId: string
): Promise<ShareLinkRow[]> {
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("media_id", mediaId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function revokeShareLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
  if (error) throw error
}

export async function deleteShareLink(linkId: string): Promise<void> {
  const { error } = await supabase.from("share_links").delete().eq("id", linkId)
  if (error) throw error
}
