"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronRight, Menu, Search } from "lucide-react"
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
  const { equipment, categories } = useStore()
  const { query, setQuery } = useEquipmentSearch()
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
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

  const openInRegister = (assetTag: string) => {
    setOpen(false)
    router.push(`/equipment?q=${encodeURIComponent(assetTag)}`)
  }

  const labels: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/equipment": "Equipment",
    "/transactions": "Check In & Check Out",
    "/maintenance": "Maintenance",
    "/reports": "Reports",
    "/settings": "Settings",
  }
  const crumbs: { href: string; label: string }[] = [
    { href: pathname, label: labels[pathname] ?? "Store" },
  ]

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
            router.push(needle ? `/equipment?q=${encodeURIComponent(query.trim())}` : "/equipment")
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
    </header>
  )
}
