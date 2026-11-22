"use client"

import * as React from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import { signOutPhase, subscribeSignOut, type VeilPhase } from "@/lib/sign-out-veil"
import { cn } from "@/lib/utils"
import logo from "@/shine baloons.png"

const IDLE = (): VeilPhase => "idle"

/**
 * The sign-out veil hangs off the root layout rather than the sidebar: signing
 * out changes the route, and anything rendered inside the dashboard layout is
 * torn down the moment /login paints. The hold lives in lib/sign-out-veil, so
 * the veil survives that jump on its own timer. The mark is the whole screen on
 * plain white: it breathes slowly, with no words and no bar underneath it, and
 * the veil fades away instead of disappearing between two frames.
 */
export function SignOutVeil() {
  const phase = React.useSyncExternalStore(subscribeSignOut, signOutPhase, IDLE)

  // `phase` only leaves idle from a click, so there is no server render to
  // match; the guard keeps the portal out of any prerender pass all the same.
  if (phase === "idle" || typeof document === "undefined") return null

  const closing = phase === "closing"

  // Hung on <body> on purpose: the sidebar sat inside an overflow-hidden aside
  // (and a drawer on phones), which would clip a fixed overlay into a sliver.
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label="Signing out"
      className={cn(
        "signout-veil fixed inset-0 z-[120] flex touch-none items-center justify-center bg-white select-none",
        closing && "signout-veil-out",
      )}
    >
      <Image
        src={logo}
        alt="Shine Balloon Safaris"
        priority
        className="signout-mark h-auto"
        style={{ width: 108, height: "auto" }}
      />
    </div>,
    document.body,
  )
}
