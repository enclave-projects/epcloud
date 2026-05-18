import * as React from "react"

import { getStorageUsage, type StorageUsage } from "@/lib/media"

export function useStorageUsage() {
  const [data, setData] = React.useState<StorageUsage | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const u = await getStorageUsage()
      setData(u)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fetch on mount
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
