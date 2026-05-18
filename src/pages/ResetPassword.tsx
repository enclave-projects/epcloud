import * as React from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { RiEyeLine, RiEyeOffLine } from "@remixicon/react"
import { toast } from "sonner"

import { AuthLayout } from "@/components/auth-layout"
import { PasswordStrength } from "@/components/password-strength"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { mapAuthError } from "@/lib/auth-errors"
import { supabase } from "@/lib/supabase"
import { PASSWORD_MAX } from "@/lib/validators"

const schema = z
  .object({
    code: z
      .string()
      .length(6, "Enter the 6-digit code")
      .regex(/^\d{6}$/, "Code must be 6 digits"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)
      .refine((v) => /[a-z]/.test(v), "Add at least one lowercase letter")
      .refine((v) => /[A-Z]/.test(v), "Add at least one uppercase letter")
      .refine((v) => /\d/.test(v), "Add at least one number")
      .refine(
        (v) => /[^a-zA-Z0-9]/.test(v),
        "Add at least one symbol (e.g. !, @, #)"
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const email = (params.get("email") ?? "").toLowerCase()

  const [showPassword, setShowPassword] = React.useState(false)
  const [topError, setTopError] = React.useState<string | null>(null)

  const {
    register: field,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { code: "", password: "", confirmPassword: "" },
  })

  React.useEffect(() => {
    if (!email) navigate("/forgot-password", { replace: true })
  }, [email, navigate])

  const codeValue = useWatch({ control, name: "code" })
  const passwordValue = useWatch({ control, name: "password" })

  const onSubmit = async (data: FormData) => {
    setTopError(null)

    // Step 1: verify the recovery OTP — this creates a temporary session
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: data.code,
      type: "recovery",
    })
    if (verifyError) {
      setTopError(mapAuthError(verifyError))
      return
    }

    // Step 2: update the password while authenticated as the recovered user
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.password,
    })
    if (updateError) {
      setTopError(mapAuthError(updateError))
      return
    }

    // Step 3: end the recovery session — make them sign in with the new pw
    await supabase.auth.signOut()
    toast.success("Password updated. Please sign in with your new password.")
    navigate("/login", { replace: true })
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={
        email
          ? `Enter the code sent to ${email} and choose a new password.`
          : "Enter your code and choose a new password."
      }
      footer={
        <>
          Didn't get a code?{" "}
          <Link
            to="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Send a new one
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
        {topError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{topError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label>Verification code</Label>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={codeValue}
              onChange={(v) =>
                setValue("code", v, {
                  shouldDirty: true,
                  shouldValidate: v.length === 6,
                })
              }
              aria-label="Verification code"
              autoFocus
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
          {errors.code ? (
            <p className="text-center text-xs text-destructive">
              {errors.code.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "password-error" : "password-strength"
              }
              className="pr-10"
              {...field("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <RiEyeOffLine aria-hidden className="size-4" />
              ) : (
                <RiEyeLine aria-hidden className="size-4" />
              )}
            </button>
          </div>
          <PasswordStrength id="password-strength" password={passwordValue} />
          {errors.password ? (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? "confirmPassword-error" : undefined
            }
            {...field("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p id="confirmPassword-error" className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  )
}
