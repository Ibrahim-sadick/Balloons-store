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
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, ready } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const [navOpen, setNavOpen] = React.useState(false)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)

  React.useEffect(() => {
    if (ready && !session) router.replace("/login")
  }, [ready, session, router])

  React.useEffect(() => {
    setNavOpen(false)
  }, [pathname])

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
