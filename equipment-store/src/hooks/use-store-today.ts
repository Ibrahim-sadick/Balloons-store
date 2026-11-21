"use client"

import * as React from "react"
import { storeToday } from "@/lib/types"

/**
 * Today, kept live. `storeToday()` already reads the clock on every call, but a
 * component only paints again when something asks it to — so a tab left open
 * overnight would keep yesterday's ceiling on its date fields until the next
 * interaction. This hook re-checks the calendar date on a short interval and
 * when the tab comes back into view, and hands back a new value only once the
 * date has actually turned over.
 *
 * What that buys: the day that becomes today opens by itself — tomorrow's date
 * is usable the moment it is today, with no reload — while every later day
 * stays shut.
 */
export function useStoreToday(): string {
  const [today, setToday] = React.useState(storeToday)

  React.useEffect(() => {
    const sync = () =>
      setToday((current) => {
        const next = storeToday()
        return next === current ? current : next
      })

    // A minute is fine for a day boundary, and cheap enough to leave running.
    const timer = setInterval(sync, 60_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") sync()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", sync)

    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", sync)
    }
  }, [])

  return today
}
