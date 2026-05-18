import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { AuthLayout } from "@/components/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { mapAuthError } from "@/lib/auth-errors"
import {
  consumeRateLimit,
  recordAuthAttempt,
} from "@/lib/rate-limit"
import { supabase } from "@/lib/supabase"
import { EMAIL_MAX } from "@/lib/validators"

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(EMAIL_MAX, `Email must be at most ${EMAIL_MAX} characters`)
    .email("Enter a valid email address")
    .toLowerCase(),
})

type FormData = z.infer<typeof schema>

const RECOVERY_MAX = 3
const RECOVERY_WINDOW_S = 10 * 60

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [error, setError] = React.useState<string | null>(null)

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: "" },
  })

  const onSubmit = async ({ email }: FormData) => {
    setError(null)

    const allowed = await consumeRateLimit(
      `recovery:${email}`,
      RECOVERY_MAX,
      RECOVERY_WINDOW_S
    )
    if (!allowed) {
      setError("Too many requests. Please wait before trying again.")
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}`,
      }
    )

    // We deliberately do not surface the success/failure of the lookup
    // (anti-enumeration). Always show a generic confirmation.
    await recordAuthAttempt(email, "password_reset_request")

    if (resetError && resetError.status && resetError.status >= 500) {
      setError(mapAuthError(resetError))
      return
    }

    toast.success("If an account exists, we've sent a reset code.")
    navigate(`/reset-password?email=${encodeURIComponent(email)}`)
  }

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send a 6-digit code to reset it."
      footer={
        <>
          Remembered it?{" "}
          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        autoComplete="on"
        className="space-y-4"
      >
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={EMAIL_MAX}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            placeholder="you@example.com"
            {...field("email")}
          />
          {errors.email ? (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset code"}
        </Button>
      </form>
    </AuthLayout>
  )
}
