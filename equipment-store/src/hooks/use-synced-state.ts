"use client"

import * as React from "react"

/**
 * Local state that follows an outside value — usually a URL search parameter —
 * without an effect. When the source changes the local copy is updated during
 * render, so the page never shows the previous filter for a frame.
 *
 * The caller stays free to change the local value afterwards: browsing the
 * table does not rewrite the URL, and the source only wins when it changes.
 */
export function useSyncedState<T>(source: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState(source)
  const [seen, setSeen] = React.useState(source)

  if (!Object.is(source, seen)) {
    setSeen(source)
    setValue(source)
  }

  return [value, setValue]
}
