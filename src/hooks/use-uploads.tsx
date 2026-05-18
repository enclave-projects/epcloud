/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import {
  uploadFile,
  validateFile,
  type UploadJob,
} from "@/lib/uploader"

/**
 * Maximum number of files actively uploading at once. Anything beyond this
 * sits in the "Queued" state until a slot frees up.
 *
 * 3 is a sweet spot: enough to saturate most upstream connections, low
 * enough that the post-upload thumbnail trigger queue (one-at-a-time)
 * doesn't pile up.
 */
const MAX_CONCURRENT = 3

type UploadContextValue = {
  jobs: UploadJob[]
  start: (files: FileList | File[]) => void
  clearFinished: () => void
  hasActive: boolean
  /**
   * Bumps every time a job leaves an active state (ready / failed /
   * cancelled). Pages that show file lists subscribe to this so the table
   * refetches as soon as a job finishes — without depending on realtime,
   * which has occasionally been flaky in self-hosted setups.
   */
  changeCounter: number
}

const UploadContext = React.createContext<UploadContextValue | undefined>(
  undefined
)

const ACTIVE_STATUSES: ReadonlySet<UploadJob["status"]> = new Set([
  "queued",
  "uploading",
  "processing",
])

export function UploadProvider({
  ownerId,
  folderId,
  children,
}: {
  ownerId: string | null
  folderId?: string | null
  children: React.ReactNode
}) {
  const [jobs, setJobs] = React.useState<UploadJob[]>([])
  const [changeCounter, setChangeCounter] = React.useState(0)

  // Worker-pool state lives in refs because (a) we mutate it from async
  // callbacks where stale closures would be a problem, and (b) we don't
  // want every queue tick to trigger a re-render.
  const queueRef = React.useRef<UploadJob[]>([])
  const activeRef = React.useRef(0)
  const ownerIdRef = React.useRef<string | null>(ownerId)
  const folderIdRef = React.useRef<string | null | undefined>(folderId)

  React.useEffect(() => {
    ownerIdRef.current = ownerId
  }, [ownerId])
  React.useEffect(() => {
    folderIdRef.current = folderId
  }, [folderId])

  const upsert = React.useCallback((job: UploadJob) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === job.id)
      const wasActive = idx !== -1 && ACTIVE_STATUSES.has(prev[idx].status)
      const isFinishing = wasActive && !ACTIVE_STATUSES.has(job.status)

      if (isFinishing) {
        // Schedule outside the setState batch so subscribers refetch once.
        queueMicrotask(() => setChangeCounter((c) => c + 1))
      }

      if (idx === -1) return [...prev, job]
      const next = prev.slice()
      next[idx] = { ...job }
      return next
    })
  }, [])

  /**
   * Fill open worker slots from the queue. Safe to call repeatedly —
   * synchronous slot reservation in the while loop guarantees we never
   * exceed `MAX_CONCURRENT`.
   *
   * `tick` self-references through `tickRef` so the React Compiler can see
   * a clean acyclic definition.
   */
  const tickRef = React.useRef<() => void>(() => {})

  const tick = React.useCallback(() => {
    while (
      activeRef.current < MAX_CONCURRENT &&
      queueRef.current.length > 0
    ) {
      const job = queueRef.current.shift()
      if (!job) break

      const owner = ownerIdRef.current
      if (!owner) {
        upsert({
          ...job,
          status: "failed",
          error: "Not signed in.",
        })
        continue
      }

      activeRef.current += 1
      void uploadFile(job, {
        ownerId: owner,
        folderId: folderIdRef.current ?? null,
        onUpdate: upsert,
      })
        .catch((e) => {
          if (job.status !== "cancelled") {
            upsert({
              ...job,
              status: "failed",
              error: e instanceof Error ? e.message : "Upload failed",
            })
          }
        })
        .finally(() => {
          activeRef.current -= 1
          // Pull the next job (if any) into the freed slot.
          tickRef.current()
        })
    }
  }, [upsert])

  React.useEffect(() => {
    tickRef.current = tick
  }, [tick])

  const start = React.useCallback(
    (files: FileList | File[]) => {
      if (!ownerIdRef.current) return
      const arr = Array.from(files)
      const toEnqueue: UploadJob[] = []

      for (const f of arr) {
        const err = validateFile(f)
        const job: UploadJob = {
          id: crypto.randomUUID(),
          file: f,
          status: err ? "failed" : "queued",
          progress: 0,
          bytesUploaded: 0,
          bytesTotal: f.size,
          error: err ?? undefined,
        }
        upsert(job)
        if (!err) toEnqueue.push(job)
      }

      if (toEnqueue.length === 0) return
      queueRef.current.push(...toEnqueue)
      tick()
    },
    [tick, upsert]
  )

  const clearFinished = React.useCallback(() => {
    setJobs((prev) => prev.filter((j) => ACTIVE_STATUSES.has(j.status)))
  }, [])

  const hasActive = jobs.some((j) => ACTIVE_STATUSES.has(j.status))

  // Warn the user before they navigate away mid-upload
  React.useEffect(() => {
    if (!hasActive) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasActive])

  const value = React.useMemo(
    () => ({ jobs, start, clearFinished, hasActive, changeCounter }),
    [jobs, start, clearFinished, hasActive, changeCounter]
  )

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  )
}

export function useUploads() {
  const ctx = React.useContext(UploadContext)
  if (!ctx) throw new Error("useUploads must be used inside UploadProvider")
  return ctx
}
