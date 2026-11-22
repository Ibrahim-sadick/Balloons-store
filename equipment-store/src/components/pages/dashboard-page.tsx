"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Boxes,
  Calendar,
  ChartPie,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  ListFilter,
  PackageCheck,
  Wrench,
} from "lucide-react"
import { DateField, FilterSelect, Panel, SearchField } from "@/components/controls"
import { EmptyState } from "@/components/empty-state"
import { LogoHold } from "@/components/layout/logo-hold"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatWhen, isPastDue } from "@/lib/format"
import { statusFor, sumCounts } from "@/lib/stock"
import { useStore } from "@/lib/store"
import { storeToday, type Equipment, type MaintenanceLog, type Transaction } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useResetWhen } from "@/hooks/use-reset-when"
import { useStoreToday } from "@/hooks/use-store-today"

type UsageSlice = { id: string; name: string; used: number; percent: number; color: string }

function usageColor(index: number) {
  const hue = Math.round((index * 137.508) % 360)
  const light = index % 2 === 0 ? 40 : 50
  return `hsl(${hue} 62% ${light}%)`
}

function sharesOf(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return values.map(() => 0)
  const raw = values.map((value) => (value / total) * 100)
  const whole = raw.map((value) => Math.floor(value))
  let left = 100 - whole.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((leftRow, rightRow) => rightRow.fraction - leftRow.fraction)
  for (const row of order) {
    if (left <= 0) break
    whole[row.index] += 1
    left -= 1
  }
  return whole
}

function point(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

function slicePath(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const outerStart = point(cx, cy, outer, start)
  const outerEnd = point(cx, cy, outer, end)
  const innerEnd = point(cx, cy, inner, end)
  const innerStart = point(cx, cy, inner, start)
  const large = start - end > Math.PI ? 1 : 0
  return `M ${outerStart.x} ${outerStart.y} A ${outer} ${outer} 0 ${large} 0 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${inner} ${inner} 0 ${large} 1 ${innerStart.x} ${innerStart.y} Z`
}

function UsageDonut({ slices }: { slices: UsageSlice[] }) {
  const drawn = slices.filter((slice) => slice.percent > 0)
  const cx = 110
  const cy = 110
  const outer = 78
  const inner = 50
  const ring = (outer + inner) / 2
  const circumference = 2 * Math.PI * ring
  // Each slice starts where the previous sweep ended. Derived from the slices
  // before it instead of mutating a running cursor inside the map.
  const arcs = drawn.map((slice, index) => {
    const sweep = (slice.percent / 100) * Math.PI * 2
    const sweptBefore = drawn
      .slice(0, index)
      .reduce((total, earlier) => total + (earlier.percent / 100) * Math.PI * 2, 0)
    const start = -Math.PI / 2 - sweptBefore
    const end = index === drawn.length - 1 ? -Math.PI / 2 - Math.PI * 2 : start - sweep
    const gap = drawn.length > 1 ? Math.min(0.04, (start - end) * 0.18) : 0
    return { ...slice, start: start - gap / 2, end: end + gap / 2 }
  })
  const summary = slices.map((slice) => `${slice.name} ${slice.percent}%`).join(", ")

  return (
    <div className="flex min-h-0 flex-1 flex-col items-stretch gap-3 bg-white p-3 sm:flex-row sm:items-center">
      <svg viewBox="0 0 220 220" className="mx-auto h-[200px] w-[200px] shrink-0" role="img" aria-label={summary}>
        <defs>
          {/* A white ring the full width of the donut, drawn by a dash that
              grows from nothing at twelve o'clock: over seven seconds the ring
              appears clockwise in one sweep instead of all at once. */}
          <mask id="usage-sweep" maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="220">
            <circle
              className="donut-sweep"
              cx={cx}
              cy={cy}
              r={ring}
              fill="none"
              stroke="#fff"
              strokeWidth={outer - inner + 4}
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          </mask>
        </defs>
        <g className="donut-settle" mask="url(#usage-sweep)">
          {arcs.length === 0 ? (
            <circle cx={cx} cy={cy} r={ring} fill="none" stroke="#e2e8f0" strokeWidth={outer - inner} />
          ) : arcs.length === 1 ? (
            <circle cx={cx} cy={cy} r={ring} fill="none" stroke={arcs[0].color} strokeWidth={outer - inner}>
              <title>{`${arcs[0].name}: ${arcs[0].used} used, ${arcs[0].percent}%`}</title>
            </circle>
          ) : (
            arcs.map((arc) => (
              <path key={arc.id} d={slicePath(cx, cy, outer, inner, arc.start, arc.end)} fill={arc.color}>
                <title>{`${arc.name}: ${arc.used} used, ${arc.percent}%`}</title>
              </path>
            ))
          )}
        </g>
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="400">
          {drawn[0] ? `${drawn[0].percent}%` : "0%"}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="400">
          Most used
        </text>
      </svg>
      <ul className="min-h-0 max-h-[240px] flex-1 space-y-2 overflow-y-auto pr-1">
        {slices.map((slice, index) => (
          <li key={slice.id}>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-normal text-slate-700">
                {slice.name}
              </span>
              <Link
                href={`/transactions?asset=${slice.id}`}
                className="font-mono text-[11px] font-normal tabular-nums hover:underline"
                style={{ color: slice.color }}
              >
                {slice.percent}%
              </Link>
            </div>
            {/* The line under each name tracks that share on the same scale for
                every item, so the longest line is also the most-used one. Over
                seven seconds it fills from the left, row after row. */}
            <div className="mt-1 ml-[18px] h-1 overflow-hidden rounded-full bg-slate-100">
              <span
                className="track-fill block h-full rounded-full"
                style={{
                  width: `${slice.percent}%`,
                  backgroundColor: slice.color,
                  animationDelay: `${index * 120}ms`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function isoUTC(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${date.getUTCFullYear()}-${month}-${day}`
}

function labelDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * How long the mark holds the screen after a day is chosen. The figures are
 * recomputed instantly, so this is a deliberate beat — long enough to read as
 * "loading an earlier day" and short enough not to feel like a stall.
 */
const AS_OF_HOLD_MS = 5500

// The dashboard opens on the half-dozen newest movements. Anything older is one
// press away rather than six rows of scrolling the panel cannot show at once.
const RECENT_VISIBLE = 6

type StatTone = "slate" | "emerald" | "rose" | "amber"

/** One colour per reading: a solid tile behind the icon, and the figure itself. */
const statTones: Record<StatTone, { tile: string; value: string }> = {
  slate: { tile: "bg-slate-800 text-white", value: "text-slate-900" },
  emerald: { tile: "bg-emerald-600 text-white", value: "text-emerald-700" },
  rose: { tile: "bg-rose-600 text-white", value: "text-rose-700" },
  amber: { tile: "bg-amber-500 text-white", value: "text-amber-700" },
}

type Stat = {
  label: string
  value: number
  hint: string
  icon: typeof Boxes
  tone: StatTone
  alert?: boolean
}

function shiftMonth(cursor: string, delta: number) {
  const [year, month] = cursor.split("-").map(Number)
  return isoUTC(new Date(Date.UTC(year, month - 1 + delta, 1))).slice(0, 7)
}

function monthCells(cursor: string) {
  const [year, month] = cursor.split("-").map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: { iso: string; day: number; inMonth: boolean }[] = []
  for (let index = first.getUTCDay(); index > 0; index -= 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - index))
    cells.push({ iso: isoUTC(date), day: date.getUTCDate(), inMonth: false })
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({ iso: isoUTC(new Date(Date.UTC(year, month - 1, day))), day, inMonth: true })
  }
  for (let index = 1; cells.length % 7 !== 0; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, days + index))
    cells.push({ iso: isoUTC(date), day: date.getUTCDate(), inMonth: false })
  }
  return { label: first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), cells }
}

function countsAsOf(item: Equipment, transactions: Transaction[], maintenance: MaintenanceLog[], date: string) {
  const mine = transactions.filter((entry) => entry.equipmentId === item.id && entry.issuedOn <= date)
  const issued = mine
    .filter((entry) => !entry.returnedOn || entry.returnedOn > date)
    .reduce((sum, entry) => sum + entry.quantity, 0)
  const returned = mine
    .filter((entry) => entry.returnedOn && entry.returnedOn <= date)
    .reduce((sum, entry) => sum + entry.quantity, 0)
  const held = maintenance
    .filter(
      (entry) =>
        entry.equipmentId === item.id &&
        entry.status !== "completed" &&
        entry.openedOn <= date &&
        (!entry.completedOn || entry.completedOn > date),
    )
    .reduce((sum, entry) => sum + entry.quantity, 0)
  return {
    name: item.name,
    total: item.quantity,
    available: Math.max(0, item.quantity - issued - held),
    issued,
    returned,
    maintenance: held,
  }
}

function TrendCalendar({
  value,
  onChange,
  marked,
}: {
  value: string
  onChange: (iso: string) => void
  marked: ReadonlySet<string>
}) {
  const [cursor, setCursor] = React.useState(value.slice(0, 7))
  // Follow the selected day when it moves; the month arrows stay independent.
  useResetWhen(value, () => setCursor(value.slice(0, 7)))
  const month = monthCells(cursor)
  // Today is the last day that can be asked for: the dashboard replays what has
  // already happened, so a day the store has not reached yet stays shut — and
  // there is no month past this one worth browsing. Read live, so the day that
  // becomes today opens by itself while the screen is still open.
  const limit = useStoreToday()
  const atLatestMonth = cursor >= limit.slice(0, 7)

  return (
    <div className="flex h-full flex-col bg-white px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="Previous month"
          onClick={() => setCursor((current) => shiftMonth(current, -1))}
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </button>
        <p className="text-[12px] font-normal text-slate-800">{month.label}</p>
        <button
          type="button"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 transition-colors duration-150",
            atLatestMonth ? "cursor-not-allowed text-slate-300" : "text-slate-500 hover:bg-slate-50",
          )}
          aria-label="Next month"
          disabled={atLatestMonth}
          onClick={() => setCursor((current) => shiftMonth(current, 1))}
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day} className="py-1 text-center text-[10px] font-normal text-slate-400">
            {day}
          </span>
        ))}
      </div>
      <div className="mt-1 grid flex-1 auto-rows-fr grid-cols-7 gap-1">
        {month.cells.map((cell) => {
          const selected = cell.iso === value
          const today = cell.iso === limit
          const future = cell.iso > limit
          return (
            <button
              key={cell.iso}
              type="button"
              aria-label={labelDate(cell.iso)}
              aria-pressed={selected}
              disabled={future}
              onClick={() => onChange(cell.iso)}
              className={cn(
                "relative flex h-full min-h-7 items-center justify-center rounded-md text-[11px] font-normal tabular-nums transition-colors duration-150",
                future
                  ? "cursor-not-allowed text-slate-200"
                  : selected
                    ? "bg-emerald-600 text-white"
                    : cell.inMonth
                      ? "text-slate-700 hover:bg-emerald-50"
                      : "text-slate-300 hover:bg-slate-50",
                today && !selected && "ring-1 ring-emerald-600",
              )}
            >
              {cell.day}
              {marked.has(cell.iso) ? (
                <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", selected ? "bg-white" : "bg-emerald-600")} />
              ) : null}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] font-normal text-slate-500">
        {labelDate(value)}. Every record on or before this day loads across the dashboard. Days after today stay shut.
      </p>
    </div>
  )
}

export function DashboardPage() {
  const { equipment, categories, locations, transactions, activity, maintenance } = useStore()
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [asOf, setAsOf] = React.useState(storeToday())
  // A picked day is answered with the logo alone; `nonce` lets a second pick
  // restart the same hold instead of landing on an older timer.
  const [hold, setHold] = React.useState<{ nonce: number; date: string } | null>(null)
  // The list stops at six rows until it is expanded. A new day starts closed,
  // so the panel always opens on the same short view it opened on yesterday.
  const [allActivity, setAllActivity] = React.useState(false)
  React.useEffect(() => {
    if (!hold) return
    const timer = setTimeout(() => setHold(null), AS_OF_HOLD_MS)
    return () => clearTimeout(timer)
  }, [hold])
  const cutoff = asOf || storeToday()
  useResetWhen(cutoff, () => setAllActivity(false))

  // Choosing a day replays the register as it stood then. The mark stands in
  // for that work so the change never reads as a silent flicker. Days after
  // today are refused here as well as in the calendar, so a typed date cannot
  // slip past the closed cells.
  const pickDate = (iso: string) => {
    if (iso === asOf) return
    if (iso && iso > storeToday()) return
    setAsOf(iso)
    setHold({ nonce: (hold?.nonce ?? 0) + 1, date: iso || storeToday() })
  }
  const needle = query.trim().toLowerCase()

  const textOf = (asset: Equipment) => {
    const category = categories.find((entry) => entry.id === asset.categoryId)
    const location = locations.find((entry) => entry.id === asset.locationId)
    return [asset.name, asset.assetTag, asset.serialNumber, asset.manufacturer, asset.model, category?.name ?? "", location?.name ?? ""]
      .join(" ")
      .toLowerCase()
  }
  const matchesSearch = (asset: Equipment) => !needle || textOf(asset).includes(needle)
  const snapshots = equipment
    .filter((asset) => asset.acquiredOn <= cutoff && matchesSearch(asset))
    .map((asset) => ({ asset, counts: countsAsOf(asset, transactions, maintenance, cutoff) }))
    .filter((row) => status === "all" || statusFor(row.counts) === status)
  const visibleIds = new Set(snapshots.map((row) => row.asset.id))
  const totals = sumCounts(snapshots.map((row) => row.counts))
  const overdue = transactions.filter(
    (item) =>
      visibleIds.has(item.equipmentId) &&
      item.issuedOn <= cutoff &&
      (!item.returnedOn || item.returnedOn > cutoff) &&
      isPastDue(item.expectedReturn, cutoff),
  )
  const returned = transactions.filter(
    (item) => Boolean(item.returnedOn) && item.returnedOn! <= cutoff && visibleIds.has(item.equipmentId),
  )
  const recent = activity.filter((item) => item.at.slice(0, 10) <= cutoff && (!item.equipmentId || visibleIds.has(item.equipmentId)))
  // Six rows, or the whole log once the expand control is pressed.
  const shownActivity = allActivity ? recent : recent.slice(0, RECENT_VISIBLE)
  const marked = new Set<string>()
  for (const item of transactions) {
    const asset = equipment.find((entry) => entry.id === item.equipmentId)
    if (!asset || !matchesSearch(asset)) continue
    marked.add(item.issuedOn)
    if (item.returnedOn) marked.add(item.returnedOn)
  }
  for (const item of activity) {
    if (item.equipmentId && !equipment.some((asset) => asset.id === item.equipmentId && matchesSearch(asset))) continue
    marked.add(item.at.slice(0, 10))
  }
  for (const log of maintenance) {
    const asset = equipment.find((entry) => entry.id === log.equipmentId)
    if (!asset || !matchesSearch(asset)) continue
    marked.add(log.openedOn)
    if (log.completedOn) marked.add(log.completedOn)
  }
  const ranked = snapshots
    .map(({ asset, counts }) => ({
      id: asset.id,
      name: asset.name.trim() || "Unnamed",
      used: counts.issued + counts.returned,
    }))
    .sort((left, right) => right.used - left.used || left.name.localeCompare(right.name))
  const percents = sharesOf(ranked.map((row) => row.used))
  const mostUsed = ranked.map((row, index) => ({
    ...row,
    percent: percents[index] ?? 0,
    color: usageColor(index),
  }))

  // These four read the pieces on the register: the total is every unit the
  // store holds, the three states are the parts of it that are free, outside or
  // in repair.
  const states: Stat[] = [
    {
      label: "Available",
      value: totals.available,
      hint: "Ready to issue",
      icon: PackageCheck,
      tone: "emerald",
    },
    {
      label: "Checked out",
      value: totals.issued,
      hint: `${overdue.length} past the expected date`,
      icon: ArrowUpRight,
      tone: "rose",
      alert: overdue.length > 0,
    },
    {
      label: "Under maintenance",
      value: totals.maintenance,
      hint: "Off the hook for repair",
      icon: Wrench,
      tone: "amber",
    },
  ]
  const stats: Stat[] = [
    {
      label: "Total equipment",
      value: totals.total,
      hint: `On the register ${labelDate(cutoff)}`,
      icon: Boxes,
      tone: "slate",
    },
    ...states,
  ]

  // Where the window is both wide and tall enough for the two-column
  // dashboard, the column is pinned to the screen: the cards and panels keep
  // their places and the two long lists scroll inside themselves. Narrower or
  // shorter windows keep the flowing column, because pinning there would leave
  // the activity log a sliver.
  return (
    <div className="flex min-h-[calc(100vh-6.5rem)] flex-col gap-3 xl:[@media(min-height:820px)]:h-[calc(100vh-6.5rem)] xl:[@media(min-height:820px)]:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[13px] font-normal text-slate-900">Store overview</h1>
          <p className="mt-0.5 text-[11px] font-normal text-slate-500">
            {labelDate(cutoff)}. {totals.total} on the register, {totals.issued} still out, {totals.returned} back by this date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={query} onChange={setQuery} placeholder="Tag, serial, or name" />
          <FilterSelect
            value={status}
            onChange={setStatus}
            icon={<ListFilter className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />}
            options={[
              { value: "all", label: "All statuses" },
              { value: "available", label: "Available" },
              { value: "checked_out", label: "Checked out" },
              { value: "maintenance", label: "Maintenance" },
            ]}
          />
          <DateField
            value={asOf}
            onChange={pickDate}
            icon={<Calendar className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const tone = statTones[stat.tone]
          return (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-normal text-slate-500">{stat.label}</p>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone.tile)}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
              <p className={cn("mt-1.5 text-[26px] leading-none font-normal tracking-tight tabular-nums", tone.value)}>
                {stat.value}
              </p>
              <p className={cn("mt-1.5 text-[11px]", stat.alert ? "text-rose-600" : "text-slate-500")}>{stat.hint}</p>
            </div>
          )
        })}
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-5">
        <Panel
          fill
          className="xl:col-span-3"
          title="Most used"
          count={ranked.length}
          icon={<ChartPie className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />}
        >
          {mostUsed.length === 0 ? (
            <EmptyState
              className="flex-1 justify-center"
              icon={ChartPie}
              title={`Nothing used by ${labelDate(cutoff)}`}
              description="Every item issued on or before the selected date shows here as a share of all use."
            />
          ) : (
            <UsageDonut slices={mostUsed} />
          )}
        </Panel>
        <Panel
          fill
          className="xl:col-span-2"
          title="Calendar"
          icon={<Calendar className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />}
        >
          <TrendCalendar value={cutoff} onChange={pickDate} marked={marked} />
        </Panel>
      </div>

      <div className="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-5">
        <div className="flex min-h-0 flex-col xl:col-span-3">
        <Panel
          fill
          className="min-h-full flex-1"
          title="Back on the hook"
          count={returned.length}
          icon={<ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />}
        >
          {returned.length === 0 ? (
            <EmptyState
              className="flex-1 justify-center"
              icon={ClipboardCheck}
              title={`Nothing came back by ${labelDate(cutoff)}`}
              description="Every return recorded on or before the selected date shows here with its condition."
            />
          ) : (
          <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Asset", "Returned by", "Date", "Condition"].map((label) => (
                  <TableHead key={label} className="h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {returned.map((item) => {
                  const asset = equipment.find((entry) => entry.id === item.equipmentId)
                  return (
                    <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="px-3 py-2.5">
                        <span className="text-[12px] font-normal text-slate-900">{asset?.name}</span>
                        <p className="font-mono text-[10px] tabular-nums text-slate-500">{asset?.assetTag}</p>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-[12px] text-slate-700">{item.returnedBy || item.issuedTo}</TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-700">{item.returnedOn}</TableCell>
                      <TableCell className="px-3 py-2.5 text-[12px] text-slate-700">{item.conditionIn ?? "—"}</TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
          </div>
          )}
        </Panel>
        </div>

        <Panel fill className="min-h-full xl:col-span-2" title="Recent store activity" count={recent.length} icon={<ClipboardCheck className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />}>
          {/* The log is the only thing that scrolls. On a tall screen the panel
              takes the height the dashboard has left, so opening the whole
              history fills that space and the list travels inside it — the page
              itself stays where it was. Shorter screens get a list about the
              height of the six rows it replaces, so one press still reveals the
              whole history without adding a page of height. */}
          <ul
            className={cn(
              "flex min-h-0 flex-1 flex-col divide-y divide-slate-200 overflow-auto",
              allActivity && "max-h-[46vh] xl:[@media(min-height:820px)]:max-h-none",
            )}
          >
            {recent.length === 0 ? (
              <li className="flex flex-1">
                <EmptyState
                  className="flex-1 justify-center"
                  icon={ClipboardCheck}
                  title={`No activity by ${labelDate(cutoff)}`}
                  description="Every issue, return, and maintenance log on or before the selected date shows here."
                />
              </li>
            ) : (
              shownActivity.map((item, index) => (
                <li key={item.id} className="flex items-start gap-2 px-3 py-2.5">
                  <span
                    className={cn(
                      "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] tabular-nums",
                      index === 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500",
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-slate-800">
                      {index === 0 ? (
                        <CircleCheck
                          aria-hidden="true"
                          className="mr-1 inline h-3 w-3 align-[-1px] text-emerald-600"
                          strokeWidth={1.75}
                        />
                      ) : null}
                      <span className="font-normal text-slate-900">{item.actor}</span>{" "}
                      {item.summary}
                    </p>
                    <span className="mt-1 block font-mono text-[10px] tabular-nums text-slate-500">{formatWhen(item.at)}</span>
                  </div>
                </li>
              ))
            )}
          </ul>
          {/* Everything past the sixth movement is kept behind this one press:
              the panel stays short, and the whole log is still one click away. */}
          {recent.length > RECENT_VISIBLE ? (
            <div className="shrink-0 border-t border-slate-200 px-3 py-1.5">
              <button
                type="button"
                onClick={() => setAllActivity((open) => !open)}
                aria-expanded={allActivity}
                className="flex w-full items-center justify-center gap-1 rounded-md py-0.5 text-[11px] font-normal text-slate-600 transition-colors hover:text-emerald-700"
              >
                {allActivity ? "Show fewer" : `Show all ${recent.length} activities`}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
                    allActivity && "rotate-180",
                  )}
                  strokeWidth={1.75}
                />
              </button>
            </div>
          ) : null}
        </Panel>
      </div>

      {hold ? <LogoHold label={`Loading the register as it stood on ${labelDate(hold.date)}`} /> : null}
    </div>
  )
}
