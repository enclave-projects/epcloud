import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { RiEyeLine, RiEyeOffLine } from "@remixicon/react"
import { toast } from "sonner"

import { AuthLayout } from "@/components/auth-layout"
import { PasswordStrength } from "@/components/password-strength"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { register } from "@/lib/auth"
import {
  EMAIL_MAX,
  FULL_NAME_MAX,
  PASSWORD_MAX,
  registerSchema,
  type RegisterInput,
} from "@/lib/validators"

export default function RegisterPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = React.useState(false)
  const [topError, setTopError] = React.useState<string | null>(null)

  const {
    register: field,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const passwordValue = useWatch({ control, name: "password" })

  const onSubmit = async (data: RegisterInput) => {
    setTopError(null)
    const result = await register(data)
    if (!result.ok) {
      setTopError(result.message)
      return
    }
    toast.success("Account created. Check your email for the code.")
    navigate(`/verify-email?email=${encodeURIComponent(data.email.toLowerCase())}`)
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start hosting your media in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
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
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            maxLength={FULL_NAME_MAX}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
            placeholder="Ada Lovelace"
            {...field("fullName")}
          />
          {errors.fullName ? (
            <p id="fullName-error" className="text-xs text-destructive">
              {errors.fullName.message}
            </p>
          ) : null}
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
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
          <Label htmlFor="confirmPassword">Confirm password</Label>
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
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our terms and privacy policy.
        </p>
      </form>
    </AuthLayout>
  )
}
