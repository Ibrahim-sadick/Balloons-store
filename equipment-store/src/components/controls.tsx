"use client"

import * as React from "react"
import { Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useStoreToday } from "@/hooks/use-store-today"

export function PageIntro({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-3">
      <h1 className="text-[13px] font-normal text-slate-900">{title}</h1>
      <p className="mt-0.5 text-[11px] font-normal text-slate-500">{description}</p>
    </div>
  )
}

export function Panel({
  title,
  count,
  icon,
  children,
  className,
  fill,
  action,
}: {
  title: string
  count?: number
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  fill?: boolean
  action?: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs",
        fill && "flex h-full flex-col",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h2 className="truncate text-[11px] font-normal text-slate-700">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {count !== undefined ? (
            <span className="font-mono text-[11px] tabular-nums text-slate-500">{count}</span>
          ) : null}
          {action}
        </div>
      </div>
      <div className={cn(fill && "flex min-h-0 flex-1 flex-col")}>{children}</div>
    </section>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        strokeWidth={1.75}
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 w-full min-w-[200px] rounded-md border-slate-200 bg-white pr-8 pl-8 text-[12px] shadow-2xs sm:w-64"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}

export function DateField({
  value,
  onChange,
  icon,
  max,
}: {
  value: string
  onChange: (value: string) => void
  icon?: React.ReactNode
  /**
   * The latest day that can be picked. Defaults to whichever day is today right
   * now, because every field using this control names a day that has already
   * happened — a filter bound, a date acquired, a date returned. Days after
   * today stay shut, and the day that turns into today opens on its own.
   */
  max?: string
}) {
  // Live, so a screen left open overnight does not keep yesterday's ceiling.
  const today = useStoreToday()
  const ceiling = max ?? today

  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 shadow-2xs">
      {icon}
      <input
        type="date"
        value={value}
        max={ceiling}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Date"
        className="bg-transparent font-mono text-[11px] tabular-nums text-slate-800 outline-none [color-scheme:light]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-slate-400 hover:text-slate-700"
          aria-label="Clear date"
        >
          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}

export function FilterSelect({
  value,
  onChange,
  options,
  className,
  icon,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
  icon?: React.ReactNode
}) {
  const items = Object.fromEntries(options.map((option) => [option.value, option.label]))
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => onChange(next ?? options[0]?.value ?? "")}
    >
      <SelectTrigger
        className={cn(
          "h-8 rounded-md border-slate-200 bg-white text-[12px] shadow-2xs",
          className,
        )}
      >
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function EmeraldButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "h-7 rounded-md bg-emerald-600 px-3 text-[10px] leading-none font-normal whitespace-nowrap text-white hover:bg-emerald-700",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

export function PillButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "h-7 rounded-full bg-emerald-600 px-3.5 text-[10px] leading-none font-normal whitespace-nowrap text-white shadow-none hover:bg-emerald-700",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

export function SlateButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "h-7 rounded-md bg-emerald-600 px-3 text-[10px] leading-none font-normal whitespace-nowrap text-white hover:bg-emerald-700",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return <p className="text-[11px] text-rose-700">{message}</p>
}

/**
 * The "this request is in flight" mark. Sits in the icon slot of a button so the
 * label can change without the button jumping.
 *
 * The movement lives in `.spinner-orbit` (globals.css) rather than in Tailwind's
 * `animate-spin`, because this app clamps every animation to 0.01ms for devices
 * that ask for reduced motion — which froze this mark into a still image. The
 * class is exempt there and turns once every 2.4s.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("h-4 w-4 spinner-orbit", className)}
      strokeWidth={1.75}
    />
  )
}

export const fieldInputClass =
  "h-8 rounded-md border-slate-200 bg-white text-[12px] shadow-2xs"
