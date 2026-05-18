import * as React from "react"

import {
  listMedia,
  type MediaListFilters,
  type MediaListResult,
  type MediaRow,
} from "@/lib/media"
import { supabase } from "@/lib/supabase"

export function useMediaList(
  filters: MediaListFilters,
  refreshKey = 0
) {
  const [state, setState] = React.useState<{
    rows: MediaRow[]
    count: number
    loading: boolean
    error: Error | null
  }>({ rows: [], count: 0, loading: true, error: null })

  // Stable filter key so we don't refetch on every render
  const key = JSON.stringify(filters)

  React.useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional loading flip
    setState((s) => ({ ...s, loading: true }))
    listMedia(filters)
      .then((res: MediaListResult) => {
        if (cancelled) return
        setState({
          rows: res.rows,
          count: res.count,
          loading: false,
          error: null,
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e : new Error(String(e)),
        }))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey])

  return state
}

/**
 * Subscribes to realtime changes on the current user's media. Bumps a
 * counter that callers can pass into useMediaList to trigger a refetch.
 */
export function useMediaRealtimeCounter(userId: string | undefined) {
  const [counter, setCounter] = React.useState(0)

  React.useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`media-changes:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "media",
          filter: `owner_id=eq.${userId}`,
        },
        () => setCounter((c) => c + 1)
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return counter
}
