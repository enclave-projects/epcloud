import * as React from "react"
import type { Session, User } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

type AuthState = {
  user: User | null
  session: Session | null
  loading: boolean
}

/**
 * Subscribes to Supabase auth state and exposes the current session/user.
 * Loading is true until the initial session check resolves.
 */
export function useAuth(): AuthState {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  React.useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return
        setState({
          user: session?.user ?? null,
          session,
          loading: false,
        })
      }
    )

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}
