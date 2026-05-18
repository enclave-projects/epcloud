import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useStorageUsage } from "@/hooks/use-storage-usage"
import { formatBytes } from "@/lib/storage"

const TOTAL_BYTES = 5 * 1024 ** 3 // 5 GB during preview

export function StorageMeter() {
  const { data, loading } = useStorageUsage()
  const used = data?.used_bytes ?? 0
  const pct = TOTAL_BYTES === 0 ? 0 : (used / TOTAL_BYTES) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">Storage</span>
        {loading ? (
          <Skeleton className="h-3 w-20" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {formatBytes(used)} of {formatBytes(TOTAL_BYTES)}
          </span>
        )}
      </div>
      <Progress value={pct} aria-label="Storage used" />
      <Button variant="outline" size="sm" className="w-full">
        Upgrade plan
      </Button>
    </div>
  )
}
