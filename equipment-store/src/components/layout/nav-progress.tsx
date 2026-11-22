"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  NAV_PROGRESS_FADE_MS,
  NAV_PROGRESS_MS,
  cancelNavProgress,
  navProgressPhase,
  subscribeNavProgress,
  type LinePhase,
} from "@/lib/nav-progress"
import { useScrollLock } from "@/hooks/use-scroll-lock"

const IDLE_PHASE: LinePhase = "idle"
const readIdlePhase = () => IDLE_PHASE

/** Width of the glow that rides the leading edge, in pixels. */
const HEAD_WIDTH = 32

/**
 * The sweep's shape. Away from the left edge at once, then a long, gentle
 * climb into the right one: a straight line over seven seconds reads as a
 * stalled bar, while an ease-in-and-out sits still for the first second. This
 * curve is ahead of the pace early and still visibly travelling late, so the
 * line looks like it is making ground the whole way across.
 */
function sweep(at: number) {
  return 1 - Math.pow(1 - at, 1.7)
}

/** The way out: slow to let go, quick through the middle, soft at the end. */
function fadeOut(at: number) {
  return at * at * (3 - 2 * at)
}

/**
 * The loading line: four pixels across the very top of the window, filled from
 * the left edge to the right in seven seconds, held at full width for two, then
 * faded out over one. It is mounted once in the root layout rather than in the
 * header, so the same line is the wait on the login card, on a section change,
 * over the sign-out veil, and the receipt for a saved movement.
 *
 * Progress is written straight to the node inside one animation frame loop: a
 * line that re-renders React sixty times a second to move three pixels buys
 * nothing.
 */
export function NavProgress() {
  const phase = React.useSyncExternalStore(subscribeNavProgress, navProgressPhase, readIdlePhase)
  const pathname = usePathname()
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const barRef = React.useRef<HTMLDivElement>(null)
  const headRef = React.useRef<HTMLDivElement>(null)

  // A page that changed without the line (browser Back, a redirect) cancels it:
  // the pending screen belongs to a place the operator has already left.
  React.useEffect(() => {
    cancelNavProgress()
  }, [pathname])

  // Nothing scrolls while the line is out. A held screen that can still be
  // dragged around reads like a page that already changed, so the document is
  // frozen where it stands — position kept, not reset — and handed back exactly
  // as it was found once the bar is empty again.
  useScrollLock(phase !== "idle")

  React.useEffect(() => {
    const wrap = wrapRef.current
    const bar = barRef.current
    const head = headRef.current
    if (!wrap || !bar) return

    if (phase === "idle") {
      // Already gone. Nothing is left mid-flight, so the next run starts from an
      // empty bar at full strength.
      wrap.style.opacity = "0"
      bar.style.transform = "scaleX(0)"
      if (head) head.style.transform = `translate3d(-${HEAD_WIDTH / 2}px, 0, 0)`
      return
    }

    if (phase === "finishing") {
      // The line has arrived and served its standstill. Only the opacity moves,
      // and it is stepped by hand rather than left to a CSS transition: this app
      // clamps every transition to 0.01ms when the machine asks for reduced
      // motion, which would make the asked-for one second exit instantaneous.
      bar.style.transform = "scaleX(1)"
      if (head) head.style.transform = `translate3d(${wrap.clientWidth}px, 0, 0)`
      const started = performance.now()
      let frame = window.requestAnimationFrame(function fade(now: number) {
        const at = Math.min(1, (now - started) / NAV_PROGRESS_FADE_MS)
        wrap.style.opacity = String(1 - fadeOut(at))
        if (at < 1) frame = window.requestAnimationFrame(fade)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    // The bar is scaled rather than resized, and the leading glow is moved on
    // its own so the soft edge is never stretched with it. Both are written to
    // the compositor every frame, which is what keeps the travel even instead
    // of stepping in pixels. Stepped in frames for the same reason as the exit:
    // the sweep must not depend on a transition that can be clamped.
    wrap.style.opacity = "1"
    bar.style.transform = "scaleX(0)"
    if (head) head.style.transform = `translate3d(-${HEAD_WIDTH / 2}px, 0, 0)`
    const started = performance.now()
    let frame = window.requestAnimationFrame(function tick(now: number) {
      const at = Math.min(1, (now - started) / NAV_PROGRESS_MS)
      const drawn = sweep(at)
      bar.style.transform = `scaleX(${drawn})`
      if (head) head.style.transform = `translate3d(${drawn * wrap.clientWidth - HEAD_WIDTH / 2}px, 0, 0)`
      if (at < 1) frame = window.requestAnimationFrame(tick)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [phase])

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[130] h-1 opacity-0"
    >
      {/* No `scale-x-0` here. Tailwind 4 writes `scale-x-*` to the standalone
          `scale` property, while the sweep is written to `transform`; both apply,
          so the class would hold the bar at zero width and the line would never
          be seen at any point of the run. The width is the transform, only. */}
      <div
        ref={barRef}
        className="h-full w-full origin-left rounded-r-full bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(5,150,105,0.55)] will-change-transform"
      />
      {/* The soft read-head: a blurred dot of light sitting on the leading
          edge, so the line has something travelling with it instead of only a
          hard edge widening. Moved by transform only, so it never reflows. */}
      <div
        ref={headRef}
        className="absolute top-0 left-0 h-full w-8 rounded-full bg-emerald-300 blur-[6px] will-change-transform"
      />
    </div>
  )
}
