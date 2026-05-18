# `send-email` Edge Function

This function is the **Send Email Auth Hook** for EP Cloud. Supabase Auth invokes
it for every transactional email (signup confirmation, password recovery,
magic link, email change, reauthentication). It renders a branded HTML
template and ships the email through Resend.

```
GoTrue → POST hook → standardwebhooks.verify() → Resend.emails.send()
```

## Required secrets

Set these once via the Supabase CLI:

```sh
# Edit this file with the real values, do NOT commit it
cp supabase/functions/send-email/.env.example supabase/functions/send-email/.env

supabase secrets set --env-file supabase/functions/send-email/.env
```

| Secret | Description |
|---|---|
| `RESEND_API_KEY` | API key from https://resend.com/api-keys |
| `SENDER_EMAIL` | Verified sender (e.g. `ep-cloud@enclaveprojects.dev`) |
| `SEND_EMAIL_HOOK_SECRET` | Paste the `v1,whsec_...` value from the dashboard hook config; the function strips the prefix automatically |

`SUPABASE_URL` is injected by the Edge Functions runtime — no need to set it.

## Deploy

```sh
supabase functions deploy send-email --no-verify-jwt
```

`--no-verify-jwt` is required because Auth Hooks call this without an
end-user JWT — they authenticate with the webhook signature instead.

## Deployed URL

`https://supabase.enclaveprojects.dev/functions/v1/send-email`

## Wire it up (self-hosted)

For a self-hosted Supabase, the Send Email Hook is configured via env vars
on the **GoTrue / `auth`** service (not via a dashboard panel). On the host
running your Supabase stack:

**1. Append to `~/supabase/docker/.env`:**

```env
# Function secrets (consumed by the functions container)
RESEND_API_KEY=re_...
SENDER_EMAIL=ep-cloud@enclaveprojects.dev
SEND_EMAIL_HOOK_SECRET=v1,whsec_<base64-secret>

# GoTrue hook routing (consumed by the auth container)
GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
GOTRUE_HOOK_SEND_EMAIL_URI=http://host.docker.internal:8000/functions/v1/send-email
GOTRUE_HOOK_SEND_EMAIL_SECRETS=v1,whsec_<base64-secret>
GOTRUE_MAILER_EXTERNAL_HOSTS=supabase.enclaveprojects.dev
```

The `SEND_EMAIL_HOOK_SECRET` and `GOTRUE_HOOK_SEND_EMAIL_SECRETS` MUST be
byte-identical — they're the shared HMAC key.

**2. URL choice:** Use `http://host.docker.internal:8000/...`, NOT the public
URL. Reasons:
- GoTrue v2.186+ only allows HTTP hook hosts of `localhost`, `127.0.0.1`,
  `::1`, or `host.docker.internal`. The public HTTPS URL gets blocked
  with a `Failed to reach hook within 5s` timeout (hairpin NAT).
- Routing via Kong on `:8000` keeps requests inside the Docker network
  while still passing through your gateway's rate limits / routing.

**3. On Linux**, add `host.docker.internal` to `/etc/hosts` of the auth
container by adding `extra_hosts` to the `auth` service in
`docker-compose.yml`:

```yaml
auth:
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

**4. In `docker-compose.yml`**, uncomment the `GOTRUE_HOOK_SEND_EMAIL_*`
lines under the `auth` service and bind them to the env vars:

```yaml
auth:
  environment:
    GOTRUE_HOOK_SEND_EMAIL_ENABLED: ${GOTRUE_HOOK_SEND_EMAIL_ENABLED}
    GOTRUE_HOOK_SEND_EMAIL_URI: ${GOTRUE_HOOK_SEND_EMAIL_URI}
    GOTRUE_HOOK_SEND_EMAIL_SECRETS: ${GOTRUE_HOOK_SEND_EMAIL_SECRETS}
    GOTRUE_MAILER_EXTERNAL_HOSTS: ${GOTRUE_MAILER_EXTERNAL_HOSTS}
```

And under the `functions` service, forward the Resend secrets:

```yaml
functions:
  environment:
    RESEND_API_KEY: ${RESEND_API_KEY}
    SENDER_EMAIL: ${SENDER_EMAIL}
    SEND_EMAIL_HOOK_SECRET: ${SEND_EMAIL_HOOK_SECRET}
```

**5. Restart only the affected services:**

```sh
cd ~/supabase/docker
docker compose up -d --force-recreate --no-deps auth functions
```

**6. Verify:**

```sh
docker compose exec auth env | grep GOTRUE_HOOK_SEND_EMAIL
docker compose exec functions env | grep -E 'RESEND|SENDER_EMAIL|HOOK_SECRET'
```

Then try a real signup — the auth log should show
`"Hook ran successfully" success: true`.

From this point on, every signup confirmation, password recovery, magic-link,
and email-change email is sent by Resend with EP Cloud branding.

## Templates

See `templates.ts`. One file holds five branded templates:

- `signup` — account verification (used by `/verify-email`)
- `recovery` — password reset OTP (used by `/forgot-password` → `/reset-password`)
- `magiclink`
- `email_change`
- `reauthentication`

Every email contains both the 6-digit `{{ .Token }}` and a fallback
confirmation link that hits `/auth/v1/verify` on the project URL.
