"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Phone,
  ScrollText,
  Settings,
  Wrench,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import logo from "@/shine baloons.png"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export const navSections = [
  {
    label: "Menu",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/equipment", label: "Equipment", icon: Package },
      { href: "/transactions", label: "Check In & Check Out", icon: ArrowLeftRight },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/reports", label: "Reports", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
]

export function BrandMark({ width = 200 }: { width?: number }) {
  return (
    <Image
      src={logo}
      alt="Shine Balloon Safaris"
      priority
      className="h-auto"
      style={{ width, height: "auto" }}
    />
  )
}

export function SidebarBody({
  onNavigate,
  onHide,
}: {
  onNavigate?: () => void
  onHide?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useStore()

  return (
    <div className="flex h-full w-[200px] flex-col bg-white">
      <div className="flex shrink-0 items-center justify-center px-4 pt-3 pb-2">
        <BrandMark width={92} />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4 last:mb-0">
            <div className="flex items-center gap-1 px-2 pb-1">
              <button
                type="button"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Hide sidebar"
                onClick={onHide}
              >
                <Menu className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              </button>
              <p className="text-[10px] font-normal tracking-wide text-slate-400 uppercase">
                {section.label}
              </p>
            </div>
            <div className="mt-1 flex flex-col gap-3 pl-6">
              {section.items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex h-7 items-center gap-2 rounded-lg px-2 text-[11px] font-normal transition-colors duration-200",
                      active
                        ? "bg-emerald-600 text-white"
                        : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-2">
        <div className="flex flex-col gap-3 pl-6">
        <p className="flex h-7 items-center gap-2 rounded-lg px-2 text-[11px] font-normal text-slate-500">
          <Headset className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Support Ticket
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-normal text-slate-500 transition-colors duration-200 outline-none hover:bg-emerald-50 hover:text-emerald-700 data-popup-open:bg-emerald-50 data-popup-open:text-emerald-700">
            <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            +255 764068763
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="flex min-w-[168px] flex-col gap-1">
            <DropdownMenuItem
              className="text-[11px] font-normal text-slate-700"
              onClick={() => {
                window.location.href = "tel:+255764068763"
              }}
            >
              <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Call
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[11px] font-normal text-slate-700"
              onClick={() => {
                window.open("https://wa.me/255764068763", "_blank", "noopener,noreferrer")
              }}
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Text on WhatsApp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          className="flex h-7 w-full items-center gap-2 rounded-md border border-rose-600 bg-rose-600 px-2 text-[11px] font-normal text-white transition-colors duration-200 hover:bg-rose-700"
          onClick={() => {
            signOut()
            onNavigate?.()
            router.replace("/login")
          }}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Log out
        </button>
        </div>
      </div>
    </div>
  )
}
