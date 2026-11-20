"use client"

import * as React from "react"

export function QrMark({ seed }: { seed: string }) {
  const cells = React.useMemo(() => {
    let hash = 0
    for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
    const size = 13
    const grid: boolean[] = []
    for (let index = 0; index < size * size; index += 1) {
      hash = (hash * 1664525 + 1013904223) >>> 0
      const x = index % size
      const y = Math.floor(index / size)
      const inFinder =
        (x < 4 && y < 4) || (x > size - 5 && y < 4) || (x < 4 && y > size - 5)
      const frame = x === 0 || y === 0 || x === 3 || y === 3
      grid.push(inFinder ? frame || (x + y) % 2 === 0 : hash % 3 !== 0)
    }
    return grid
  }, [seed])

  return (
    <div
      className="grid gap-px bg-white p-0.5"
      style={{ gridTemplateColumns: "repeat(13, 6px)" }}
      aria-hidden
    >
      {cells.map((filled, index) => (
        <span
          key={index}
          className={filled ? "h-1.5 w-1.5 bg-slate-900" : "h-1.5 w-1.5 bg-white"}
        />
      ))}
    </div>
  )
}
