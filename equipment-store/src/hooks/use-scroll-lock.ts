"use client"

import * as React from "react"

/**
 * A freeze for the document while a wait is on screen.
 *
 * Counted at module level because two waits can overlap: a picked dashboard day
 * can still be held by the logo when the line for a section change starts, and
 * the page has to stay frozen until the last one is done — then be handed back
 * exactly as it was found, position kept.
 */

const SCROLL_KEYS = new Set([
  " ",
  "Spacebar",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
])

let held = 0
let saved: { rootOverflow: string; bodyOverflow: string; bodyPadding: string } | null = null
let stopPointer: ((event: Event) => void) | null = null
let stopKey: ((event: KeyboardEvent) => void) | null = null

/** Arrows and Space belong to a field being typed in, not to the page. */
function isTyping(target: EventTarget | null) {
  const node = target as HTMLElement | null
  if (!node) return false
  if (node.isContentEditable) return true
  return node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT"
}

function freeze() {
  const root = document.documentElement
  const body = document.body
  saved = {
    rootOverflow: root.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPadding: body.style.paddingRight,
  }
  // The scrollbar goes with overflow:hidden. Holding its width as padding
  // stops the whole layout from jumping sideways when it disappears.
  const gutter = window.innerWidth - root.clientWidth
  root.style.overflow = "hidden"
  body.style.overflow = "hidden"
  if (gutter > 0) body.style.paddingRight = `${gutter}px`

  // Wheel and touch are stopped in capture, so a scrollable panel inside the
  // frozen page (a wide table, the activity list) cannot be dragged either.
  stopPointer = (event: Event) => event.preventDefault()
  document.addEventListener("wheel", stopPointer, { passive: false, capture: true })
  document.addEventListener("touchmove", stopPointer, { passive: false, capture: true })

  // The keyboard scrolls without the wheel: Space and Page Down move the page,
  // the arrows move whatever list has the focus.
  stopKey = (event: KeyboardEvent) => {
    if (!SCROLL_KEYS.has(event.key) || isTyping(event.target)) return
    event.preventDefault()
  }
  document.addEventListener("keydown", stopKey, { capture: true })
}

function thaw() {
  const root = document.documentElement
  const body = document.body
  if (saved) {
    root.style.overflow = saved.rootOverflow
    body.style.overflow = saved.bodyOverflow
    body.style.paddingRight = saved.bodyPadding
    saved = null
  }
  if (stopPointer) {
    document.removeEventListener("wheel", stopPointer, true)
    document.removeEventListener("touchmove", stopPointer, true)
    stopPointer = null
  }
  if (stopKey) {
    document.removeEventListener("keydown", stopKey, true)
    stopKey = null
  }
}

export function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return
    held += 1
    if (held === 1) freeze()
    return () => {
      held = Math.max(0, held - 1)
      if (held === 0) thaw()
    }
  }, [active])
}
