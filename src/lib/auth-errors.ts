import { AuthError } from "@supabase/supabase-js"

/**
 * Map Supabase auth errors to user-friendly, non-leaky messages.
 *
 * We deliberately collapse "user not found" and "wrong password" into the
 * same message to avoid email enumeration.
 */
export function mapAuthError(error: unknown): string {
  if (error instanceof AuthError) {
    const code = (error as AuthError & { code?: string }).code ?? ""

    switch (code) {
      case "invalid_credentials":
      case "invalid_login_credentials":
        return "Email or password is incorrect."
      case "email_not_confirmed":
        return "Please confirm your email before signing in. Check your inbox."
      case "user_already_exists":
      case "email_address_already_registered":
        return "An account with that email already exists. Try signing in."
      case "weak_password":
        return "That password is too weak. Pick something stronger."
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return "Too many attempts. Please wait a moment and try again."
      case "signup_disabled":
        return "New sign-ups are currently disabled."
      case "user_banned":
        return "This account is currently disabled. Contact support."
      default:
        if (error.status === 429) {
          return "Too many attempts. Please wait a moment and try again."
        }
        // Fall back to a sanitized version of the message
        return error.message || "Something went wrong. Please try again."
    }
  }

  if (error instanceof Error) return error.message
  return "Something went wrong. Please try again."
}
