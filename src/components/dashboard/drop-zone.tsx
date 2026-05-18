import * as React from "react"
import { RiUploadCloud2Line } from "@remixicon/react"

import { useUploads } from "@/hooks/use-uploads"
import { cn } from "@/lib/utils"

type DropZoneProps = {
  className?: string
  children?: React.ReactNode
}

/**
 * Page-wide drag-and-drop overlay. Renders nothing while idle; dimmed
 * overlay + dashed border when files are being dragged onto the window.
 */
export function GlobalDropZone({ children }: { children: React.ReactNode }) {
  const { start } = useUploads()
  const [active, setActive] = React.useState(false)
  const dragCounter = React.useRef(0)

  React.useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return
      e.preventDefault()
      dragCounter.current += 1
      setActive(true)
    }
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current -= 1
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setActive(false)
      }
    }
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return
      e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      dragCounter.current = 0
      setActive(false)
      void start(e.dataTransfer.files)
    }
    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", onDrop)
    }
  }, [start])

  return (
    <>
      {children}
      {active ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-sm"
        >
          <div className="rounded-xl border-2 border-dashed border-primary bg-background px-10 py-12 text-center shadow-lg">
            <RiUploadCloud2Line
              className="mx-auto size-10 text-primary"
              aria-hidden
            />
            <p className="mt-3 text-base font-medium">Drop to upload</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Files will go straight to your media library.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}

/**
 * Inline button-like dropzone for empty states. Doubles as a click target
 * that opens the native file picker.
 */
export function DropZoneButton({ className }: DropZoneProps) {
  const { start } = useUploads()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [hover, setHover] = React.useState(false)

  return (
    <div
      className={cn("inline-block", className)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault()
          setHover(true)
        }
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault()
          setHover(false)
          void start(e.dataTransfer.files)
        }
      }}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-background px-6 py-10 text-center transition-colors",
          hover
            ? "border-primary bg-primary/5"
            : "border-muted hover:border-primary/40 hover:bg-muted/40"
        )}
      >
        <RiUploadCloud2Line
          className="size-8 text-muted-foreground"
          aria-hidden
        />
        <span className="text-sm font-medium">Drop files here, or click to browse</span>
        <span className="text-xs text-muted-foreground">
          Any file type · up to 2 GB each
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            void start(e.target.files)
            // Reset so the same file can be picked again
            e.target.value = ""
          }
        }}
      />
    </div>
  )
}
