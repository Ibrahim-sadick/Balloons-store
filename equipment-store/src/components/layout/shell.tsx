"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { AppHeader, EquipmentSearchProvider } from "@/components/layout/header"
import { SidebarBody } from "@/components/layout/sidebar"
import { startNavProgress } from "@/lib/nav-progress"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useResetWhen } from "@/hooks/use-reset-when"

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, ready } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const [navOpen, setNavOpen] = React.useState(false)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)

  React.useEffect(() => {
    // A tag on a shelf is scanned by someone who is not signed in yet, so the
    // address the code carried has to survive the sign-in. /login reads `next`
    // back and hands over to it instead of the dashboard.
    if (ready && !session) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [ready, session, pathname, router])

  // A route change means the mobile drawer has done its job.
  useResetWhen(pathname, () => setNavOpen(false))

  // Every internal link asks for the line first, and the router is only called
  // once it has crossed: sidebar items, breadcrumbs, table rows, report links.
  // Capture runs ahead of Link's own handler and marks the click handled, which
  // is exactly what stops Link from navigating now; the link's own onClick
  // (closing the phone drawer) still runs.
  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.("a[href]")
      if (!anchor) return
      if (anchor.getAttribute("target") === "_blank" || anchor.hasAttribute("download")) return
      const next = new URL(anchor.getAttribute("href") ?? "", window.location.href)
      if (next.origin !== window.location.origin) return
      // A new query on the section already open is a filter, not a page change:
      // holding the filter back seven seconds would be nonsense.
      if (next.pathname === window.location.pathname) return
      event.preventDefault()
      setNavOpen(false)
      const href = `${next.pathname}${next.search}${next.hash}`
      startNavProgress(() => router.push(href))
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={cn(
          "fixed top-4 bottom-4 left-4 z-30 hidden w-[200px] overflow-hidden rounded-lg border border-slate-200 bg-white transition-transform duration-200 ease-out lg:block",
          sidebarOpen ? "translate-x-0" : "pointer-events-none -translate-x-[calc(100%+1.25rem)]",
        )}
      >
        <SidebarBody onHide={() => setSidebarOpen(false)} />
      </aside>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[200px] gap-0 bg-white p-0 sm:max-w-[200px]"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Store sections</SheetDescription>
          <SidebarBody
            onNavigate={() => setNavOpen(false)}
            onHide={() => setNavOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <EquipmentSearchProvider>
      <div className={cn("transition-[padding-left] duration-200 ease-out", sidebarOpen ? "lg:pl-[232px]" : "lg:pl-0")}>
        <AppHeader
          showMenu={!sidebarOpen}
          onMenu={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) setSidebarOpen(true)
            else setNavOpen(true)
          }}
        />
        <main
          key={pathname}
          className="px-4 py-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 lg:px-6 lg:py-5"
        >
          {children}
        </main>
      </div>
      </EquipmentSearchProvider>
    </div>
  )
}
