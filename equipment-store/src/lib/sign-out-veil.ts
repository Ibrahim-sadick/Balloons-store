/**
 * The sign-out veil is shared state rather than a piece of the sidebar.
 *
 * It has to outlive the route change: the session is dropped at once, the URL
 * moves to /login, and the veil keeps the screen for the hold so the operator
 * still sees the mark close the till. Because this module owns the timer and
 * nothing in it can touch auth, a hold that is still running when the next
 * sign-in happens cannot clear that new session.
 */
export const SIGN_OUT_MS = 5000

let open = false
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeSignOut(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function isSigningOut() {
  return open
}

/** Call after the session has been dropped; only the veil is timed from here. */
export function startSignOut() {
  open = true
  emit()
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    open = false
    timer = undefined
    emit()
  }, SIGN_OUT_MS)
}
