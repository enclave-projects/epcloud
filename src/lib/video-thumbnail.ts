/**
 * Generate a JPEG thumbnail from a video File entirely in the browser.
 *
 * Why client-side?
 *   - The supabase/edge-runtime user-worker isolate blocks `Deno.Command`,
 *     so we can't shell out to ffmpeg inside `generate-thumbnail`.
 *   - Pure-JS video decoders are heavy and unreliable.
 *   - The browser already has a hardware-accelerated decoder.
 *
 * Pipeline:
 *   1. Build an object URL from the File
 *   2. Spin up a hidden <video> element, seek to 10% of its duration
 *      (or 1.0s, whichever is smaller — handles short clips)
 *   3. Wait for the `seeked` event, draw the current frame to a <canvas>
 *      sized so the long edge is ≤ 1280
 *   4. Export the canvas as JPEG (quality 0.78)
 *   5. Always clean up the object URL & DOM element
 */

const TARGET_LONG_EDGE = 1280
const QUALITY = 0.78
// Hard cap so a corrupt file can't wedge the upload pipeline.
const TIMEOUT_MS = 30_000

export type VideoThumbnailResult = {
  blob: Blob
  width: number
  height: number
  durationSeconds: number | null
}

export async function generateVideoThumbnail(
  file: File
): Promise<VideoThumbnailResult> {
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  // crossOrigin not needed for blob: URLs, but make it explicit.
  video.preload = "metadata"
  video.src = url

  try {
    await waitForLoadedMetadata(video)
    const seekTarget = Number.isFinite(video.duration)
      ? Math.min(1, Math.max(0, video.duration * 0.1))
      : 0
    video.currentTime = seekTarget
    await waitForSeeked(video)

    const naturalW = video.videoWidth
    const naturalH = video.videoHeight
    if (!naturalW || !naturalH) {
      throw new Error("Video has zero dimensions")
    }

    const long = Math.max(naturalW, naturalH)
    const scale = long > TARGET_LONG_EDGE ? TARGET_LONG_EDGE / long : 1
    const targetW = Math.max(1, Math.round(naturalW * scale))
    const targetH = Math.max(1, Math.round(naturalH * scale))

    const canvas = document.createElement("canvas")
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("Couldn't get 2D canvas context")
    ctx.drawImage(video, 0, 0, targetW, targetH)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        QUALITY
      )
    })

    return {
      blob,
      width: naturalW,
      height: naturalH,
      durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
    }
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute("src")
    try {
      video.load()
    } catch {
      // ignore
    }
  }
}

function waitForLoadedMetadata(video: HTMLVideoElement): Promise<void> {
  return waitFor(video, "loadedmetadata")
}

function waitForSeeked(video: HTMLVideoElement): Promise<void> {
  return waitFor(video, "seeked")
}

function waitFor(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for ${event}`))
    }, TIMEOUT_MS)
    const cleanup = () => {
      window.clearTimeout(timer)
      video.removeEventListener(event, onSuccess)
      video.removeEventListener("error", onError)
    }
    const onSuccess = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("Video failed to load"))
    }
    video.addEventListener(event, onSuccess, { once: true })
    video.addEventListener("error", onError, { once: true })
  })
}
