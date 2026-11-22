/**
 * The loading line across the top of the app, and the gate that holds the next
 * screen back until it has crossed.
 *
 * A section change here is instant — every page paints from the bootstrap
 * snapshot the store already holds — so the line is not reporting a wait, it is
 * the wait. It sweeps the whole width of the bar, stands at the right edge for a
 * beat so the end is actually seen, then fades out. The screen is only allowed
 * to change once the bar is empty again.
 *
 * The same line is the receipt for a save. A return, a check-out and a
 * maintenance log all run it, so a recorded movement ends the way a section
 * change does instead of a form blinking away mid-sweep.
 *
 * The state lives here rather than in a component because the click that starts
 * it (shell), the line that draws it (root layout), the search that jumps
 * (header), the sign-in (login card), the sign-out (sidebar) and the dialogs
 * that wait on it all sit in different trees, and the pending destination has to
 * survive whichever of them unmounts first.
 */

/** The sweep: left edge to right edge at a constant speed, seven seconds. */
export const NAV_PROGRESS_MS = 7_000

/** The standstill at the end, so the line is seen arriving, not cut off. */
export const NAV_PROGRESS_HOLD_MS = 2_000

/** The way out: slow enough to be watched going rather than blinked away. */
export const NAV_PROGRESS_FADE_MS = 1_000

/** First pixel to empty bar again. */
export const NAV_PROGRESS_TOTAL_MS = NAV_PROGRESS_MS + NAV_PROGRESS_HOLD_MS + NAV_PROGRESS_FADE_MS

/**
 * "running" is the sweep and the standstill together, "finishing" is the fade,
 * and "idle" is the only phase that shows nothing at all.
 */
export type LinePhase = "idle" | "running" | "finishing"

let phase: LinePhase = "idle"
let destination: (() => void) | undefined
let holdTimer: ReturnType<typeof setTimeout> | undefined
let fadeTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const waiting = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeNavProgress(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function navProgressPhase(): LinePhase {
  return phase
}

/**
 * Hands back everyone waiting on the line. Deferred by one turn of the loop so
 * the document is unfrozen and the bar already empty by the time a dialog acts
 * on it — a form that closes in the same commit as the thaw can leave the page
 * stuck behind a scroll lock that no longer has an owner.
 */
function settle() {
  if (waiting.size === 0) return
  const done = [...waiting]
  waiting.clear()
  setTimeout(() => {
    for (const resolve of done) resolve()
  }, 0)
}

/**
 * Starts the line and remembers what to reveal when it is done. A second caller
 * while the line is out does not restart it: the wait already served is kept and
 * both reveals fire at the end, so a section change and a saved log never drop
 * each other.
 */
export function startNavProgress(onComplete?: () => void) {
  if (onComplete) {
    const earlier = destination
    destination = earlier
      ? () => {
          earlier()
          onComplete()
        }
      : onComplete
  }
  if (phase !== "idle") return

  phase = "running"
  holdTimer = setTimeout(() => {
    holdTimer = undefined
    if (phase !== "running") return
    phase = "finishing"
    emit()
    fadeTimer = setTimeout(() => {
      fadeTimer = undefined
      release()
    }, NAV_PROGRESS_FADE_MS)
  }, NAV_PROGRESS_MS + NAV_PROGRESS_HOLD_MS)
  emit()
}

/** The bar is empty: drop the frame and let the waiting screen in. */
function release() {
  if (phase === "idle") return
  phase = "idle"
  const reveal = destination
  destination = undefined
  emit()
  settle()
  reveal?.()
}

/**
 * Runs the line once and answers when the bar is empty again, so a save can show
 * its result on the finished animation rather than mid-sweep.
 */
export function runLoadingLine(): Promise<void> {
  return new Promise<void>((resolve) => {
    waiting.add(resolve)
    startNavProgress()
  })
}

/** Drops a pending change: the page moved on its own, or the server refused. */
export function cancelNavProgress() {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = undefined
  }
  if (fadeTimer) {
    clearTimeout(fadeTimer)
    fadeTimer = undefined
  }
  destination = undefined
  if (phase === "idle") return
  phase = "idle"
  emit()
  settle()
}
