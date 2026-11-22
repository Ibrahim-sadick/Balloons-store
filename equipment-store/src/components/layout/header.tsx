"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronRight, LogOut, Menu, Search } from "lucide-react"
import { startNavProgress } from "@/lib/nav-progress"
import { startSignOut } from "@/lib/sign-out-veil"
import { useStore } from "@/lib/store"

const EquipmentSearchContext = React.createContext<{
  query: string
  setQuery: (value: string) => void
} | null>(null)

export function EquipmentSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = React.useState("")
  return <EquipmentSearchContext.Provider value={{ query, setQuery }}>{children}</EquipmentSearchContext.Provider>
}

export function useEquipmentSearch() {
  const value = React.useContext(EquipmentSearchContext)
  if (!value) throw new Error("useEquipmentSearch must be used within EquipmentSearchProvider")
  return value
}

export function AppHeader({
  onMenu,
  showMenu,
}: {
  onMenu: () => void
  showMenu: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { equipment, categories, signOut } = useStore()
  const { query, setQuery } = useEquipmentSearch()
  const [open, setOpen] = React.useState(false)
  const [signOutOpen, setSignOutOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const logoutRef = React.useRef<HTMLDivElement>(null)
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? equipment.filter((item) => {
        const category = categories.find((entry) => entry.id === item.categoryId)
        return [item.name, item.assetTag, item.serialNumber, category?.name ?? ""].join(" ").toLowerCase().includes(needle)
      })
    : []

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  // The switch is disarmed by a press anywhere else in the header, so the
  // question never sits open behind another action.
  React.useEffect(() => {
    if (!signOutOpen) return
    const close = (event: MouseEvent) => {
      if (!logoutRef.current?.contains(event.target as Node)) setSignOutOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSignOutOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [signOutOpen])

  // The only way out of the app. The veil and the line are one wait: the logo
  // covers the screen while the line crosses the bar, and the session is only
  // dropped — and /login only shown — when both have finished.
  const leave = () => {
    setSignOutOpen(false)
    startSignOut()
    startNavProgress(() => {
      signOut()
      router.replace("/login")
    })
  }

  // Searching while the register is already open only filters it, so that jump
  // is immediate; the line is for a change of section.
  const jumpToRegister = (href: string) => {
    if (pathname === "/equipment") {
      router.push(href)
      return
    }
    startNavProgress(() => router.push(href))
  }

  const openInRegister = (assetTag: string) => {
    setOpen(false)
    jumpToRegister(`/equipment?q=${encodeURIComponent(assetTag)}`)
  }

  const labels: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/equipment": "Equipment",
    "/transactions": "Check In & Check Out",
    "/maintenance": "Maintenance",
    "/reports": "Reports",
    "/settings": "Settings",
  }
  // A nested route keeps its section in the trail, and the register answers for
  // the last step: a scanned tag reads "Store › Equipment › Helment" rather
  // than falling back to "Store › Store".
  const section = Object.keys(labels).find((href) => pathname === href || pathname.startsWith(`${href}/`))
  const nested = section && pathname !== section ? pathname.slice(section.length + 1) : ""
  const crumbs: { href: string; label: string }[] =
    section && nested
      ? [
          { href: section, label: labels[section] },
          { href: pathname, label: equipment.find((item) => item.id === nested)?.name ?? "Record" },
        ]
      : [{ href: pathname, label: section ? labels[section] : "Store" }]

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3 lg:px-4">
      <button
        type="button"
        onClick={onMenu}
        className={`flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 ${showMenu ? "" : "lg:hidden"}`}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      </button>
      <nav className="hidden min-w-0 items-center gap-1 text-[12px] sm:flex" aria-label="Breadcrumb">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-900">
          Store
        </Link>
        {crumbs.map((crumb, index) => (
          <span key={crumb.href} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={1.75} />
            {index === crumbs.length - 1 ? (
              <span className="truncate font-normal text-slate-900">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="truncate text-slate-500 hover:text-slate-900">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <div ref={wrapRef} className="relative ml-auto w-full max-w-[280px]">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
        <input
          ref={inputRef}
          value={query}
          placeholder="Search equipment"
          aria-label="Search equipment"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false)
              return
            }
            if (event.key !== "Enter") return
            event.preventDefault()
            if (matches.length === 1) {
              openInRegister(matches[0].assetTag)
              return
            }
            setOpen(false)
            jumpToRegister(needle ? `/equipment?q=${encodeURIComponent(query.trim())}` : "/equipment")
          }}
          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pr-14 pl-8 text-[12px] font-normal text-slate-900 shadow-2xs outline-none placeholder:text-slate-500"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 font-mono text-[10px] tabular-nums text-slate-400 sm:inline">
          Ctrl K
        </kbd>
        {open && needle ? (
          <div className="absolute top-9 right-0 left-0 z-30 overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
            {matches.length === 0 ? (
              <p className="px-2.5 py-2 text-[11px] font-normal text-slate-500">No equipment matches that search.</p>
            ) : (
              <ul>
                {matches.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openInRegister(item.assetTag)}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12px] font-normal text-slate-900">{item.name}</span>
                      <span className="font-mono text-[10px] tabular-nums text-slate-500">{item.assetTag}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      {/* Top right corner: one logout icon that toggles the question below it.
          It is not a switch that stays on — the icon looks the same open or
          closed, and the card sliding out is the only thing that changes. */}
      <div ref={logoutRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Log out"
          aria-expanded={signOutOpen}
          aria-controls="logout-question"
          title="Log out"
          onClick={() => setSignOutOpen((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors duration-200 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-emerald-600/30 active:bg-slate-200"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        </button>
        {signOutOpen ? (
          <div
            id="logout-question"
            className="logout-sheet absolute top-full right-0 z-40 mt-2 w-[216px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
          >
            <p className="text-[11px] font-normal text-slate-900">Log out of Ballons Store?</p>
            <p className="mt-0.5 text-[10.5px] font-normal text-slate-500">
              You will need your email and password to come back in.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setSignOutOpen(false)}
                className="h-7 flex-1 rounded-md border border-slate-200 text-[11px] font-normal text-slate-700 transition-colors hover:bg-slate-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={leave}
                className="h-7 flex-1 rounded-md border border-rose-600 bg-rose-600 text-[11px] font-normal text-white transition-colors hover:bg-rose-700"
              >
                Log out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  )
}
