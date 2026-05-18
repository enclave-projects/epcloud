/**
 * Branded HTML email templates for EP Cloud.
 *
 * Each template returns { subject, html, text } and accepts:
 *  - email           the user's email
 *  - token           the 6-digit OTP (preferred, no link prefetch issues)
 *  - confirmationUrl a fallback link the user can click
 */

const BRAND = "EP Cloud"
const PRIMARY = "#6d28d9" // violet-700, matches frontend primary
const FG = "#0a0a0a"
const MUTED = "#737373"
const BG = "#ffffff"
const BORDER = "#e5e5e5"

// Escape user-controlled strings before embedding in HTML.
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

type EmailContent = {
  subject: string
  html: string
  text: string
}

type TemplateInput = {
  email: string
  token: string
  confirmationUrl: string
}

function shell(args: {
  preheader: string
  heading: string
  intro: string
  token: string
  ctaLabel: string
  confirmationUrl: string
  footerNote: string
}): string {
  const safeHeading = escapeHtml(args.heading)
  const safeIntro = escapeHtml(args.intro)
  const safeFooterNote = escapeHtml(args.footerNote)
  const safeCtaLabel = escapeHtml(args.ctaLabel)
  const safeUrl = escapeHtml(args.confirmationUrl)
  const safeToken = escapeHtml(args.token)
  const safePreheader = escapeHtml(args.preheader)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeHeading}</title>
  </head>
  <body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${FG};">
    <span style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreheader}</span>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:${BG};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:${PRIMARY};color:${BG};font-weight:700;width:36px;height:36px;text-align:center;border-radius:8px;font-size:14px;line-height:36px;">EP</td>
                    <td style="padding-left:10px;font-size:16px;font-weight:600;color:${FG};">${BRAND}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;color:${FG};">${safeHeading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;color:${MUTED};font-size:14px;line-height:1.6;">
                ${safeIntro}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px;">
                <div style="border:1px solid ${BORDER};border-radius:10px;background:#fafafa;padding:16px 20px;text-align:center;">
                  <div style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:.08em;">Verification code</div>
                  <div style="margin-top:6px;font-size:30px;letter-spacing:.4em;font-weight:700;color:${FG};font-family:ui-monospace,'SFMono-Regular',Consolas,monospace;">${safeToken}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px;color:${MUTED};font-size:13px;line-height:1.6;">
                Or click the button below to continue without entering the code.
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px;">
                <a href="${safeUrl}" style="display:inline-block;background:${PRIMARY};color:${BG};text-decoration:none;font-weight:600;padding:11px 18px;border-radius:8px;font-size:14px;">${safeCtaLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;color:${MUTED};font-size:12px;line-height:1.6;border-top:1px solid ${BORDER};padding-top:16px;">
                ${safeFooterNote}
              </td>
            </tr>
          </table>
          <p style="color:#a3a3a3;font-size:11px;margin:16px 0 0;">© ${new Date().getFullYear()} ${BRAND}. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function plain(opts: {
  heading: string
  intro: string
  token: string
  confirmationUrl: string
  footerNote: string
}): string {
  return [
    `${BRAND}`,
    "",
    opts.heading,
    "",
    opts.intro,
    "",
    `Your verification code: ${opts.token}`,
    "",
    `Or open this link: ${opts.confirmationUrl}`,
    "",
    opts.footerNote,
  ].join("\n")
}

export function buildSignupEmail(input: TemplateInput): EmailContent {
  const heading = "Verify your email"
  const intro =
    "Welcome to EP Cloud. Use the code below to verify your email address and finish setting up your account."
  const footerNote =
    "This code expires in 1 hour. If you didn't create an account, you can safely ignore this message."
  return {
    subject: `Verify your ${BRAND} account`,
    html: shell({
      preheader: "Confirm your email to start using EP Cloud.",
      heading,
      intro,
      token: input.token,
      ctaLabel: "Verify email",
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
    text: plain({
      heading,
      intro,
      token: input.token,
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
  }
}

export function buildRecoveryEmail(input: TemplateInput): EmailContent {
  const heading = "Reset your password"
  const intro =
    "We received a request to reset your EP Cloud password. Use the code below or click the button to choose a new password."
  const footerNote =
    "This code expires in 1 hour. If you didn't request a password reset, you can ignore this email — your password will not be changed."
  return {
    subject: `Reset your ${BRAND} password`,
    html: shell({
      preheader: "Use this code to reset your EP Cloud password.",
      heading,
      intro,
      token: input.token,
      ctaLabel: "Reset password",
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
    text: plain({
      heading,
      intro,
      token: input.token,
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
  }
}

export function buildMagicLinkEmail(input: TemplateInput): EmailContent {
  const heading = "Sign in to EP Cloud"
  const intro =
    "Use the code below or click the button to sign in. This code can only be used once."
  const footerNote =
    "This code expires in 1 hour. If you didn't try to sign in, you can ignore this message."
  return {
    subject: `Your ${BRAND} sign-in code`,
    html: shell({
      preheader: "One-time sign-in code for EP Cloud.",
      heading,
      intro,
      token: input.token,
      ctaLabel: "Sign in",
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
    text: plain({
      heading,
      intro,
      token: input.token,
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
  }
}

export function buildEmailChangeEmail(input: TemplateInput): EmailContent {
  const heading = "Confirm your new email"
  const intro =
    "Use the code below or click the button to confirm your new email address."
  const footerNote =
    "If you didn't request this change, please contact support and review your account security."
  return {
    subject: `Confirm your new ${BRAND} email`,
    html: shell({
      preheader: "Confirm the email change on your EP Cloud account.",
      heading,
      intro,
      token: input.token,
      ctaLabel: "Confirm email",
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
    text: plain({
      heading,
      intro,
      token: input.token,
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
  }
}

export function buildReauthEmail(input: TemplateInput): EmailContent {
  const heading = "Confirm it's you"
  const intro =
    "Use the code below to confirm your identity for a sensitive action."
  const footerNote =
    "If you didn't request this, please ignore the email and review your account security."
  return {
    subject: `${BRAND} security code`,
    html: shell({
      preheader: "EP Cloud reauthentication code.",
      heading,
      intro,
      token: input.token,
      ctaLabel: "Confirm",
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
    text: plain({
      heading,
      intro,
      token: input.token,
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
  }
}

export function buildGenericEmail(
  actionType: string,
  input: TemplateInput
): EmailContent {
  const heading = "Action required on your account"
  const intro = `Use the code below to complete the requested action (${escapeHtml(actionType)}).`
  const footerNote =
    "If you didn't request this, you can safely ignore the email."
  return {
    subject: `${BRAND}: action required`,
    html: shell({
      preheader: "Action required on your EP Cloud account.",
      heading,
      intro,
      token: input.token,
      ctaLabel: "Continue",
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
    text: plain({
      heading,
      intro,
      token: input.token,
      confirmationUrl: input.confirmationUrl,
      footerNote,
    }),
  }
}
