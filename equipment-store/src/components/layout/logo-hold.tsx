"use client"

import * as React from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import logo from "@/shine baloons.png"

/**
 * The wait shown when the dashboard is asked for an earlier day. Nothing but the
 * mark is on screen — no word, no bar, no spinner — and the mark is the only
 * thing that moves, so the load cannot be mistaken for a second, different
 * spinner. Its blink lives in `.logo-hold-mark` (globals.css).
 *
 * The backdrop stays see-through: the dashboard keeps showing behind the mark
 * through a two-pixel blur, which is enough to lift the logo off the page and
 * still leave the figures readable while they change.
 *
 * Hung on <body> because the dashboard sits inside an overflow-hidden column;
 * a fixed overlay left in place there would be clipped.
 */
export function LogoHold({ label }: { label: string }) {
  if (typeof document === "undefined") return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="fixed inset-0 z-[110] flex touch-none items-center justify-center bg-white/10 backdrop-blur-[2px] select-none"
    >
      <Image
        src={logo}
        alt=""
        priority
        className="logo-hold-mark h-auto"
        style={{ width: 108, height: "auto" }}
      />
    </div>,
    document.body,
  )
}
