import { z } from "zod"

// =============================================================================
// Input length caps & format rules (defense in depth — also enforced server-side)
// =============================================================================

export const EMAIL_MAX = 254 // RFC 5321
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
export const FULL_NAME_MAX = 100
export const USERNAME_MIN = 3
export const USERNAME_MAX = 30

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(EMAIL_MAX, `Email must be at most ${EMAIL_MAX} characters`)
  .email("Enter a valid email address")
  .toLowerCase()

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)
  .refine((v) => /[a-z]/.test(v), "Add at least one lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Add at least one uppercase letter")
  .refine((v) => /\d/.test(v), "Add at least one number")
  .refine(
    (v) => /[^a-zA-Z0-9]/.test(v),
    "Add at least one symbol (e.g. !, @, #)"
  )

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Password is required")
    .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`),
})

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(FULL_NAME_MAX, `Full name must be at most ${FULL_NAME_MAX} characters`),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>

// Password strength scoring (0-4) for live UI feedback
export function scorePassword(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}
