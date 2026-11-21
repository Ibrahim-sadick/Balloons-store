"use client"

import * as React from "react"

/**
 * Runs `reset` while rendering when `trigger` changes, instead of in an effect.
 * This is React's documented "adjust state when a prop changes" pattern, so a
 * dialog or calendar never paints one frame of the previous record's values.
 *
 * The trigger should be a primitive — a boolean, an id, or a composed key such
 * as `${open}:${id}`. A fresh object every render would loop forever.
 */
export function useResetWhen(trigger: unknown, reset: () => void) {
  const [seen, setSeen] = React.useState(trigger)

  if (!Object.is(trigger, seen)) {
    setSeen(trigger)
    reset()
  }
}
