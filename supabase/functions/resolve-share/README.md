# `resolve-share` Edge Function

Public endpoint hit by the EP Cloud embed page to redeem a share token
and obtain short-lived signed URLs for the underlying media (and
thumbnail). No JWT required. The function rate-limits per client IP,
calls the `resolve_share_link` RPC under the service role, and returns a
small JSON envelope.

```
viewer browser → POST /functions/v1/resolve-share
              → consume_rate_limit  (per-IP sliding window)
              → sha256(token) + sha256(ip)
              → resolve_share_link(token_hash, password, origin, ip_hash, ua)
              → on success: createSignedUrl(media, 5m) [+ thumbnail]
              → 200 JSON  | 403 outcome  | 404 not_found  | 429 rate_limited
```

## Endpoint

`POST https://supabase.enclaveprojects.dev/functions/v1/resolve-share`

```
{ "token": "<base64url string>", "password": "<optional>" }
```

Headers:

| Header | Required | Notes |
|---|---|---|
| `Content-Type: application/json` | yes | |
| `Origin` | recommended | Forwarded to the RPC for the per-link origin allowlist; also used for CORS. |
| `User-Agent` | recommended | Logged in `share_link_views` (truncated to 256). |
| `CF-Connecting-IP` / `X-Forwarded-For` | recommended | Used (after sha256) for rate limiting and audit. |

CORS allowlist (hardcoded — edit `index.ts` to extend):

- `http://localhost:5173`
- `https://supabase.enclaveprojects.dev`
- TODO: add the production EP Cloud frontend domain

## Required environment

Auto-injected by the edge runtime — no manual setup needed:

| Env | Provided by |
|---|---|
| `SUPABASE_URL` | compose (`http://kong:8000`) |
| `SUPABASE_SERVICE_ROLE_KEY` | compose (`SERVICE_ROLE_KEY`) |

Tunables (all optional):

| Env | Default | Purpose |
|---|---|---|
| `RESOLVE_SHARE_RATE_MAX` | `60` | Max hits per IP per window. |
| `RESOLVE_SHARE_RATE_WINDOW_S` | `60` | Window size in seconds. |
| `RESOLVE_SHARE_RATE_BLOCK_S` | `300` | Block duration once exceeded. |
| `RESOLVE_SHARE_SIGNED_URL_TTL` | `300` | Signed URL TTL in seconds. |

## Response shape

### Success (200)

```json
{
  "ok": true,
  "media": {
    "mime_type": "image/jpeg",
    "kind": "image",
    "width": 4032,
    "height": 3024,
    "duration_seconds": null,
    "original_filename": "IMG_0123.jpg",
    "allow_download": true,
    "allow_embed": true,
    "signed_url": "https://supabase.enclaveprojects.dev/storage/v1/object/sign/media/...",
    "thumbnail_url": "https://supabase.enclaveprojects.dev/storage/v1/object/sign/thumbnails/..."
  }
}
```

`thumbnail_url` is `null` when no thumbnail exists yet (e.g. for a
freshly-uploaded video that's still `processing`).

### Failures

| HTTP | Body | Reason |
|---|---|---|
| 400 | `{ ok: false, error: "invalid_body" }` | Missing / malformed `token` field. |
| 403 | `{ ok: false, outcome: "expired" \| "revoked" \| "view_limit" \| "invalid_password" \| "origin_denied" }` | RPC rejected the request. |
| 404 | `{ ok: false, outcome: "not_found" }` | No share link with that token hash. |
| 405 | `{ ok: false, error: "method_not_allowed" }` | Non-POST request. |
| 429 | `{ ok: false, outcome: "rate_limited" }` | Sliding-window limiter triggered. |
| 500 | `{ ok: false, error: "internal_error" }` | DB / storage failure. |

## Privacy / security notes

- The token and password are validated with zod and never logged.
- The client IP is sha256-hashed before it ever leaves the function — neither the RPC nor the audit log see the raw IP.
- Signed URLs are short-lived (5 minutes by default) and minted per request; they are not cached.
- The `Cache-Control: no-store` and `Referrer-Policy: no-referrer` response headers prevent intermediaries from caching or leaking the signed URLs.
- On rate limiter failures we **fail closed** (return 429) rather than allow the request through.

## Rate limiter semantics

The function calls `public.consume_rate_limit` with bucket key
`share-resolve:<sha256-of-ip>`, max **60 hits per 60s**, blocking the
key for **5 minutes** once exceeded. Override with the env vars listed
above.

## Sanity ping

```sh
curl -s -X POST -H "Content-Type: application/json" \
  https://supabase.enclaveprojects.dev/functions/v1/resolve-share \
  -d '{"token":"deadbeefdeadbeefdeadbeefdeadbeef"}'
# Expect: {"ok":false,"outcome":"not_found"}
# Status: 404 (proves DB connectivity through the RPC).
```

## Deploy / restart

```sh
cd ~/supabase/docker
docker compose up -d --force-recreate --no-deps functions
```

No image rebuild is needed for this function — it has no native
dependencies.
