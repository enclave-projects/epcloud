// Supabase "Send Email" Auth Hook → Resend
// =========================================
// Configure this function as the Send Email Hook in:
//   GoTrue env: GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
//               GOTRUE_HOOK_SEND_EMAIL_URI=<this function URL>
//               GOTRUE_HOOK_SEND_EMAIL_SECRETS=v1,whsec_<base64>
// Required function secrets (set with `supabase secrets set --env-file ./.env`):
//   RESEND_API_KEY        - Resend API key
//   SENDER_EMAIL          - From address e.g. ep-cloud@enclaveprojects.dev
//   SEND_EMAIL_HOOK_SECRET - the webhook signing secret (paste full
//                            "v1,whsec_..." value)
//
// The hook payload includes the user, the OTP token, the token_hash, and
// the email_action_type. We render a branded HTML email and ship it via
// Resend. We respond 200 on success and 401 on signature failure to make
// GoTrue treat the email as not sent.

import { Resend } from "resend"
import { Webhook } from "standardwebhooks"

import {
  buildEmailChangeEmail,
  buildGenericEmail,
  buildMagicLinkEmail,
  buildReauthEmail,
  buildRecoveryEmail,
  buildSignupEmail,
} from "./templates.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") ?? ""
const HOOK_SECRET_RAW = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? ""
// The hook config gives you `v1,whsec_<base64>`; standardwebhooks needs
// only the base64 payload after the prefix.
const HOOK_SECRET = HOOK_SECRET_RAW.replace(/^v1,whsec_/, "")

if (!RESEND_API_KEY || !SENDER_EMAIL || !HOOK_SECRET) {
  console.error(
    "send-email: missing required secrets (RESEND_API_KEY, SENDER_EMAIL, SEND_EMAIL_HOOK_SECRET)"
  )
}

const resend = new Resend(RESEND_API_KEY)

type HookPayload = {
  user: {
    id: string
    email: string
    new_email?: string
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
    token_new?: string
    token_hash_new?: string
  }
}

/**
 * GoTrue's verify endpoint — clicking this confirms the action server-side
 * and bounces the browser to the redirect_to URL.
 */
function buildConfirmationUrl(
  siteOrSupabaseUrl: string,
  tokenHash: string,
  actionType: string,
  redirectTo: string
): string {
  // SUPABASE_URL is automatically injected for every Edge Function.
  const base = Deno.env.get("SUPABASE_URL") ?? siteOrSupabaseUrl
  const url = new URL(`${base.replace(/\/$/, "")}/auth/v1/verify`)
  url.searchParams.set("token", tokenHash)
  url.searchParams.set("type", actionType)
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo)
  return url.toString()
}

function pickTemplate(
  actionType: string,
  email: string,
  token: string,
  confirmationUrl: string
) {
  const input = { email, token, confirmationUrl }
  switch (actionType) {
    case "signup":
      return buildSignupEmail(input)
    case "recovery":
      return buildRecoveryEmail(input)
    case "magiclink":
    case "email":
      return buildMagicLinkEmail(input)
    case "email_change":
      return buildEmailChangeEmail(input)
    case "reauthentication":
      return buildReauthEmail(input)
    default:
      return buildGenericEmail(actionType, input)
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 })
  }

  const rawBody = await req.text()
  const headers = Object.fromEntries(req.headers)

  // Verify webhook signature — without this, anyone with the function URL
  // could trigger emails. standardwebhooks throws if invalid.
  let payload: HookPayload
  try {
    const wh = new Webhook(HOOK_SECRET)
    payload = wh.verify(rawBody, headers) as HookPayload
  } catch (err) {
    console.error("send-email: signature verification failed", err)
    return new Response(
      JSON.stringify({
        error: { http_code: 401, message: "invalid webhook signature" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const { user, email_data } = payload
    const actionType = email_data.email_action_type
    const recipient =
      actionType === "email_change" && user.new_email
        ? user.new_email
        : user.email

    const confirmationUrl = buildConfirmationUrl(
      email_data.site_url,
      email_data.token_hash,
      actionType,
      email_data.redirect_to
    )

    const { subject, html, text } = pickTemplate(
      actionType,
      recipient,
      email_data.token,
      confirmationUrl
    )

    const { error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: [recipient],
      subject,
      html,
      text,
      headers: {
        // Anti-abuse: tell mail clients these are transactional, no list
        "X-Entity-Ref-ID": user.id,
        "List-Unsubscribe": "<mailto:abuse@enclaveprojects.dev>",
      },
    })

    if (error) {
      console.error("send-email: resend error", error)
      return new Response(
        JSON.stringify({
          error: { http_code: 502, message: "failed to send email" },
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("send-email: unhandled error", err)
    return new Response(
      JSON.stringify({
        error: { http_code: 500, message: "internal error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
