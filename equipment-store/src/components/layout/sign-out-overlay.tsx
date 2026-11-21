"use client"

import * as React from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import { isSigningOut, subscribeSignOut } from "@/lib/sign-out-veil"
import logo from "@/shine baloons.png"

/**
 * The sign-out veil hangs off the root layout rather than the sidebar: signing
 * out changes the route, and anything rendered inside the dashboard layout is
 * torn down the moment /login paints. The hold lives in lib/sign-out-veil, so
 * the veil survives that jump on its own timer. The mark pulses slowly instead
 * of a spinner, and the bar fills over the same five seconds.
 */
export function SignOutVeil() {
  const open = React.useSyncExternalStore(subscribeSignOut, isSigningOut, () => false)

  // `open` only turns true from a click, so there is no server render to match;
  // the guard keeps the portal out of any prerender pass all the same.
  if (!open || typeof document === "undefined") return null

  // Hung on <body> on purpose: the sidebar sat inside an overflow-hidden aside
  // (and a drawer on phones), which would clip a fixed overlay into a sliver.
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label="Signing out"
      className="signout-veil fixed inset-0 z-[120] flex touch-none items-center justify-center bg-white/90 backdrop-blur-[2px] select-none"
    >
      <div className="flex w-[220px] flex-col items-center gap-4">
        <Image
          src={logo}
          alt="Shine Balloon Safaris"
          priority
          className="signout-mark h-auto"
          style={{ width: 108, height: "auto" }}
        />
        <span className="text-[12px] font-normal text-slate-600">Signing out</span>
        <div className="h-[3px] w-[168px] overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="signout-bar h-full w-full rounded-full bg-emerald-600" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
