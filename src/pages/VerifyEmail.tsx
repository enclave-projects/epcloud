import * as React from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { AuthLayout } from "@/components/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { mapAuthError } from "@/lib/auth-errors"
import {
  consumeRateLimit,
  recordAuthAttempt,
} from "@/lib/rate-limit"
import { supabase } from "@/lib/supabase"

const RESEND_MAX = 3
const RESEND_WINDOW_S = 5 * 60

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const email = (params.get("email") ?? "").toLowerCase()

  const [code, setCode] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [resending, setResending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!email) navigate("/register", { replace: true })
  }, [email, navigate])

  const handleVerify = async (token: string) => {
    setError(null)
    setSubmitting(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      })
      if (verifyError) {
        await recordAuthAttempt(email, "login_failure")
        setError(mapAuthError(verifyError))
        setCode("")
        return
      }
      await recordAuthAttempt(email, "login_success")
      toast.success("Email verified. Welcome to EP Cloud.")
      navigate("/dashboard", { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError(null)
    setResending(true)
    try {
      const allowed = await consumeRateLimit(
        `resend:${email}`,
        RESEND_MAX,
        RESEND_WINDOW_S
      )
      if (!allowed) {
        setError("Please wait a few minutes before requesting a new code.")
        return
      }
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (resendError) {
        setError(mapAuthError(resendError))
        return
      }
      toast.success("A new code has been sent.")
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        email
          ? `Enter the 6-digit code we sent to ${email}.`
          : "Enter the 6-digit code we sent you."
      }
      footer={
        <>
          Wrong email?{" "}
          <Link
            to="/register"
            className="font-medium text-primary hover:underline"
          >
            Sign up again
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v)
              if (v.length === 6 && !submitting) handleVerify(v)
            }}
            autoFocus
            aria-label="Verification code"
            disabled={submitting}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={submitting || code.length !== 6}
          onClick={() => handleVerify(code)}
        >
          {submitting ? "Verifying…" : "Verify email"}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          Didn't get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-primary hover:underline disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend"}
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}
