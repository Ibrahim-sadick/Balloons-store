import { NAV_PROGRESS_TOTAL_MS } from "./nav-progress"

/**
 * The sign-out veil is shared state rather than a piece of the sidebar.
 *
 * It has to outlive the route change: the session is dropped at once, the URL
 * moves to /login, and the veil keeps the screen for the hold so the operator
 * still sees the mark close the till. Because this module owns the timer and
 * nothing in it can touch auth, a hold that is still running when the next
 * sign-in happens cannot clear that new session.
 *
 * Three phases, because the fade-out needs a frame to play in: "open" holds the
 * screen for SIGN_OUT_MS, "closing" keeps the same overlay mounted for the
 * brush of the fade, and "idle" is the only phase that renders nothing at all.
 * Without the middle phase the white screen vanished between two frames and the
 * login card appeared in one jump.
 *
 * The hold is the loading line's own duration — sweep, standstill and fade: the
 * logo covers the screen while the line runs the bar, and /login is only shown
 * when both have finished.
 */
export const SIGN_OUT_MS = NAV_PROGRESS_TOTAL_MS

/** Matches the 260ms of `balons-veil-out` in globals.css. */
export const SIGN_OUT_FADE_MS = 260

export type VeilPhase = "idle" | "open" | "closing"

let phase: VeilPhase = "idle"
const listeners = new Set<() => void>()
let holdTimer: ReturnType<typeof setTimeout> | undefined
let fadeTimer: ReturnType<typeof setTimeout> | undefined

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeSignOut(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function signOutPhase(): VeilPhase {
  return phase
}

/** Call after the session has been dropped; only the veil is timed from here. */
export function startSignOut() {
  // A second sign-out during the fade simply starts the hold again.
  if (holdTimer) clearTimeout(holdTimer)
  if (fadeTimer) clearTimeout(fadeTimer)
  holdTimer = undefined
  fadeTimer = undefined
  phase = "open"
  emit()
  holdTimer = setTimeout(() => {
    holdTimer = undefined
    phase = "closing"
    emit()
    fadeTimer = setTimeout(() => {
      fadeTimer = undefined
      phase = "idle"
      emit()
    }, SIGN_OUT_FADE_MS)
  }, SIGN_OUT_MS)
}
