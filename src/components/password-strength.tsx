import { scorePassword } from "@/lib/validators"
import { cn } from "@/lib/utils"

const LABELS = ["Too weak", "Weak", "Fair", "Strong", "Very strong"] as const
const COLORS = [
  "bg-destructive",
  "bg-destructive",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-500",
] as const

type Props = {
  password: string
  /** Optional id used by the password input's aria-describedby */
  id?: string
}

export function PasswordStrength({ password, id }: Props) {
  const score = scorePassword(password)
  const label = LABELS[score]

  return (
    <div id={id} className="mt-2" aria-live="polite">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-label={`Password strength: ${label}`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? COLORS[score] : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {password ? label : "Use 8+ chars with upper, lower, number & symbol"}
      </p>
    </div>
  )
}
