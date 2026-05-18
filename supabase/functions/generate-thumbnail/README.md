# `generate-thumbnail` Edge Function

Generates a 1280px-long-edge JPEG thumbnail for an uploaded media row
and writes the source image's width/height back to the row. Designed to
be invoked from the EP Cloud frontend immediately after each upload
(with the user's session JWT) or, later, by a Storage webhook on the
`media` bucket.

```
client/webhook → POST /functions/v1/generate-thumbnail
              → identifyCaller (JWT or x-storage-webhook-secret)
              → load media row + assert ownership
              → status = 'processing'
              → image (PNG/JPEG/TIFF/GIF):
                  imagescript decode → resize ≤1280 (no upscale)
                  → encodeJPEG(78) → upload <owner>/<id>.jpg
                image (WebP/AVIF/HEIC/HEIF), video, audio, pdf, …:
                  no thumbnail, just mark ready
              → status = 'ready'  (or 'failed' on error)
```

## Endpoint

`POST https://supabase.enclaveprojects.dev/functions/v1/generate-thumbnail`

```
{ "media_id": "<uuid>" }
```

Headers:

| Header | Required | Notes |
|---|---|---|
| `Authorization: Bearer <user JWT>` | one of | Standard session token from supabase-js. The function asserts `media.owner_id == user.id` before processing. |
| `x-storage-webhook-secret: <value>` | one of | Skips JWT auth. Only honored when `GENERATE_THUMBNAIL_WEBHOOK_SECRET` is set. |
| `Content-Type: application/json` | yes | |
| `Origin` | recommended | CORS allowlist — see below. |

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

Optional:

| Env | Default | Purpose |
|---|---|---|
| `GENERATE_THUMBNAIL_WEBHOOK_SECRET` | _(unset)_ | When set, requests bearing `x-storage-webhook-secret: <value>` skip user JWT auth. |

## Runtime constraint — why imagescript, not sharp/ffmpeg

The supabase/edge-runtime user-worker isolate **forbids subprocess
spawning**. Any `Deno.Command(...)` throws:

```
Error: Spawning subprocesses is not allowed on Supabase Edge Runtime.
```

That rules out:

- `sharp` — its native add-on doesn't load reliably under the Deno npm
  shim, and even if it did, it would need extra system packages.
- ImageMagick (`convert`, `identify`) — system binary, requires
  subprocess spawning.
- ffmpeg / ffprobe — system binary, requires subprocess spawning.

We therefore use **[imagescript](https://deno.land/x/imagescript)**, a
pure-Deno image library with zero native dependencies.

Caveats of imagescript v1.3.0 we accept:

- **No WebP encoder.** Output is JPEG @ q78. Files are uploaded as
  `image/jpeg` with extension `.jpg`. JPEG q78 is comparable in size
  to WebP q78 for typical photographic content.
- **No WebP / AVIF / HEIC / HEIF decoder.** When a user uploads one of
  these formats, the function does **not** generate a thumbnail; the
  row is still moved to `status='ready'` with `thumbnail_path=null`.
  The frontend already shows a placeholder icon for null thumbnails.
- **No EXIF orientation handling.** imagescript doesn't read EXIF tags,
  so re-encoding does NOT auto-rotate. Most browser uploads have
  orientation already baked into the pixels, so this rarely matters.
  We can add a small EXIF reader later if users complain about
  rotated photos.

## Video thumbnails — deferred

Generating a video thumbnail in pure JS would require shipping a WASM
decoder (e.g. `@ffmpeg/ffmpeg`) into the function bundle, which adds
~30 MB of cold-start cost and decodes much slower than native ffmpeg.
For now the function:

- Marks every video upload `status='ready'` immediately.
- Sets `thumbnail_path`, `width`, `height`, `duration_seconds` to
  `null`.
- Returns `200 { ok: true, kind: "video", … }`.

Video thumbnailing will be picked up by a separate worker (likely a
small Node service running ffmpeg + sharp directly) once the rest of
the product ships. Until then, the frontend renders a video icon
placeholder for videos with no thumbnail.

## Thumbnail output

| Property | Value |
|---|---|
| Bucket | `thumbnails` (private) |
| Path | `<owner_id>/<media_id>.jpg` |
| Format | JPEG (`image/jpeg`) |
| Long edge | up to **1280px**, never upscaled |
| Quality | **78** |
| Metadata | none (re-encoding strips EXIF) |
| Cache-Control | `31536000, immutable` |

## Status transitions

| Trigger | Status |
|---|---|
| Initial upload (insert by client) | `uploading` |
| This function picks up the row | `processing` |
| Pipeline succeeds | `ready` |
| Pipeline throws | `failed` |
| Already `ready` on entry | no-op, returns `{ ok: true, idempotent: true }` |

## Errors

| HTTP | Body | Reason |
|---|---|---|
| 400 | `{ error: "invalid_body" }` | Missing / malformed `media_id`. |
| 401 | `{ error: "unauthorized" }` | No valid JWT and no webhook secret. |
| 403 | `{ error: "forbidden" }` | Caller does not own the media. |
| 404 | `{ error: "not_found" }` | No `media` row with that id. |
| 405 | `{ error: "method_not_allowed" }` | Non-POST request. |
| 500 | `{ error: "internal_error" }` | DB lookup failed. |
| 500 | `{ error: "pipeline_failed" }` | Decode / encode / upload failed. Row marked `failed`. |

The function never logs the request body. Failures are logged as
`generate-thumbnail: <stage> <error>` on stderr.

## Sanity ping

```sh
curl -i -X POST -H "Content-Type: application/json" \
  https://supabase.enclaveprojects.dev/functions/v1/generate-thumbnail \
  -d '{"media_id":"00000000-0000-0000-0000-000000000000"}'
# Expect 401 unauthorized — proves the function is reachable.
```

## Deploy / restart

The function is plain Deno + imagescript with no system dependencies,
so the stock `supabase/edge-runtime` image works:

```sh
cd ~/supabase/docker
docker compose up -d --force-recreate --no-deps functions
```

If you previously built `ep-cloud-edge-runtime:ffmpeg` with a
Dockerfile, you can revert the `functions:` service in
`docker-compose.yml` back to `image: supabase/edge-runtime:<version>`
(no `build:` block). The custom image is no longer needed.
