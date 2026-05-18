import * as React from "react"

/**
 * Returns handlers for detecting a long-press (touch or mouse).
 * Fires `onLongPress` after `delay` ms of sustained press.
 * Cancels if the user moves their finger/mouse or lifts early.
 */
export function useLongPress(
  onLongPress: () => void,
  delay = 500
): {
  onPointerDown: React.PointerEventHandler
  onPointerUp: React.PointerEventHandler
  onPointerLeave: React.PointerEventHandler
  onContextMenu: React.MouseEventHandler
} {
  const timerRef = React.useRef<number | null>(null)
  const firedRef = React.useRef(false)

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const start = () => {
    firedRef.current = false
    clear()
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true
      onLongPress()
    }, delay)
  }

  return {
    onPointerDown: () => start(),
    onPointerUp: () => clear(),
    onPointerLeave: () => clear(),
    // Prevent context menu on long press (mobile)
    onContextMenu: (e) => {
      if (firedRef.current) e.preventDefault()
    },
  }
}
