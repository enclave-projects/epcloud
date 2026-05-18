import { supabase } from "@/lib/supabase"
import { mapAuthError } from "@/lib/auth-errors"
import {
  checkBruteForce,
  consumeRateLimit,
  recordAuthAttempt,
} from "@/lib/rate-limit"
import type { LoginInput, RegisterInput } from "@/lib/validators"

export type AuthResult =
  | { ok: true }
  | { ok: false; message: string; code?: "rate_limit" | "brute_force" | "auth" }

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
// Login: 5 attempts per 5 min, then 15-min block per email
const LOGIN_MAX_HITS = 5
const LOGIN_WINDOW_S = 5 * 60
const LOGIN_BLOCK_S = 15 * 60
// Signup: 3 attempts per 10 min per email (email enumeration mitigation)
const SIGNUP_MAX_HITS = 3
const SIGNUP_WINDOW_S = 10 * 60
// Brute force lockout
const BRUTE_FORCE_MAX = 5
const BRUTE_FORCE_WINDOW_M = 15

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase()

  // Sliding-window rate limit (blocks bulk credential stuffing per email)
  const allowed = await consumeRateLimit(
    `login:${email}`,
    LOGIN_MAX_HITS,
    LOGIN_WINDOW_S,
    LOGIN_BLOCK_S
  )
  if (!allowed) {
    await recordAuthAttempt(email, "rate_limit_block")
    return {
      ok: false,
      code: "rate_limit",
      message: "Too many attempts. Please try again in 15 minutes.",
    }
  }

  // Brute-force protection: count recent failures
  const notLocked = await checkBruteForce(
    email,
    BRUTE_FORCE_MAX,
    BRUTE_FORCE_WINDOW_M
  )
  if (!notLocked) {
    await recordAuthAttempt(email, "brute_force_block")
    return {
      ok: false,
      code: "brute_force",
      message: "Account temporarily locked due to repeated failed sign-ins.",
    }
  }

  // Real auth call (password is hashed server-side by Supabase / GoTrue)
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  })

  if (error) {
    await recordAuthAttempt(email, "login_failure")
    return { ok: false, code: "auth", message: mapAuthError(error) }
  }

  await recordAuthAttempt(email, "login_success")
  return { ok: true }
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase()

  const allowed = await consumeRateLimit(
    `signup:${email}`,
    SIGNUP_MAX_HITS,
    SIGNUP_WINDOW_S
  )
  if (!allowed) {
    await recordAuthAttempt(email, "rate_limit_block")
    return {
      ok: false,
      code: "rate_limit",
      message: "Too many sign-up attempts. Please try again later.",
    }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
      },
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  })

  if (error) {
    await recordAuthAttempt(email, "signup_failure")
    return { ok: false, code: "auth", message: mapAuthError(error) }
  }

  await recordAuthAttempt(email, "signup_success")
  return { ok: true }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}
