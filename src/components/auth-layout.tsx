import * as React from "react"
import { Link } from "react-router-dom"

type AuthLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
  footer?: React.ReactNode
}

/**
 * Split-screen layout used by /login and /register.
 * The marketing panel collapses on small screens.
 */
export function AuthLayout({
  children,
  title,
  subtitle,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left — marketing / brand */}
      <aside
        aria-label="Product overview"
        className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-primary-foreground"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.18), transparent 50%)",
          }}
        />
        <div className="relative">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-heading text-xl font-semibold"
          >
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-md bg-primary-foreground text-primary"
            >
              EP
            </span>
            EP Cloud
          </Link>
        </div>

        <div className="relative max-w-md space-y-4">
          <h2 className="font-heading text-3xl leading-tight font-semibold">
            Host your media. Share with confidence.
          </h2>
          <p className="text-primary-foreground/80">
            EP Cloud gives you encrypted, signed URLs for every image and video
            you upload — embed them anywhere, expire them anytime.
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li className="flex items-start gap-2">
              <span aria-hidden>•</span>
              End-to-end TLS, signed access tokens
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden>•</span>
              Direct, fast embeds for any site
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden>•</span>
              Granular control over every share
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} EP Cloud. All rights reserved.
        </p>
      </aside>

      {/* Right — form */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 font-heading text-lg font-semibold lg:hidden"
          >
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"
            >
              EP
            </span>
            EP Cloud
          </Link>

          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>

          <div className="mt-8">{children}</div>

          {footer ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
