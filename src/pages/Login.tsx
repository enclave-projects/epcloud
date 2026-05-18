import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { RiEyeLine, RiEyeOffLine } from "@remixicon/react"
import { toast } from "sonner"

import { AuthLayout } from "@/components/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login } from "@/lib/auth"
import {
  EMAIL_MAX,
  PASSWORD_MAX,
  loginSchema,
  type LoginInput,
} from "@/lib/validators"

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = React.useState(false)
  const [topError, setTopError] = React.useState<string | null>(null)

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    "/dashboard"

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (data: LoginInput) => {
    setTopError(null)
    const result = await login(data)
    if (!result.ok) {
      setTopError(result.message)
      return
    }
    toast.success("Welcome back!")
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your media library."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              tabIndex={-1}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              maxLength={PASSWORD_MAX}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
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
          {errors.password ? (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  )
}
