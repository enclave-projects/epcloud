import { supabase } from "@/lib/supabase"

/**
 * Client-side wrappers for the SECURITY DEFINER rate-limit / brute-force
 * functions defined in migration `20260518000002_auth_rate_limiting.sql`.
 *
 * These run inside Postgres atomically, so even if a malicious client tries
 * to spam, the bucket counters are accurate per request that reaches the API.
 */

export async function consumeRateLimit(
  bucketKey: string,
  maxHits: number,
  windowSeconds: number,
  blockSeconds?: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket_key: bucketKey,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds ?? undefined,
  })
  if (error) {
    // Fail closed: if the rate-limit function itself errors, do not allow
    // unbounded retries. Surface a generic error.
    console.error("rate-limit error", error)
    return false
  }
  return data === true
}

export async function checkBruteForce(
  email: string,
  maxFailures = 5,
  windowMinutes = 15
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_brute_force", {
    p_email: email,
    p_max_failures: maxFailures,
    p_window_minutes: windowMinutes,
  })
  if (error) {
    console.error("brute-force check error", error)
    return false
  }
  return data === true
}

export async function recordAuthAttempt(
  email: string,
  eventType:
    | "login_success"
    | "login_failure"
    | "signup_success"
    | "signup_failure"
    | "password_reset_request"
    | "rate_limit_block"
    | "brute_force_block",
  userAgent?: string
): Promise<void> {
  const { error } = await supabase.rpc("record_auth_attempt", {
    p_email: email,
    p_event_type: eventType,
    p_user_agent: userAgent ?? navigator.userAgent.slice(0, 256),
  })
  if (error) console.error("audit error", error)
}
