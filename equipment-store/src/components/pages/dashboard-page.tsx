"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Calendar,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  ListFilter,
  Package,
  Wrench,
} from "lucide-react"
import { DateField, FilterSelect, Panel, SearchField } from "@/components/controls"
import { EmptyState } from "@/components/empty-state"
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
import { STORE_TODAY, type Equipment, type MaintenanceLog, type Transaction } from "@/lib/types"
import { cn } from "@/lib/utils"

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
  let cursor = -Math.PI / 2
  const arcs = drawn.map((slice, index) => {
    const sweep = (slice.percent / 100) * Math.PI * 2
    const start = cursor
    const end = index === drawn.length - 1 ? -Math.PI / 2 - Math.PI * 2 : cursor - sweep
    cursor -= sweep
    const gap = drawn.length > 1 ? Math.min(0.04, (start - end) * 0.18) : 0
    return { ...slice, start: start - gap / 2, end: end + gap / 2 }
  })
  const summary = slices.map((slice) => `${slice.name} ${slice.percent}%`).join(", ")

  return (
    <div className="flex min-h-0 flex-1 flex-col items-stretch gap-3 bg-white p-3 sm:flex-row sm:items-center">
      <svg viewBox="0 0 220 220" className="mx-auto h-[200px] w-[200px] shrink-0" role="img" aria-label={summary}>
        {arcs.length === 0 ? (
          <circle cx={cx} cy={cy} r={(outer + inner) / 2} fill="none" stroke="#e2e8f0" strokeWidth={outer - inner} />
        ) : arcs.length === 1 ? (
          <circle cx={cx} cy={cy} r={(outer + inner) / 2} fill="none" stroke={arcs[0].color} strokeWidth={outer - inner}>
            <title>{`${arcs[0].name}: ${arcs[0].used} used, ${arcs[0].percent}%`}</title>
          </circle>
        ) : (
          arcs.map((arc) => (
            <path key={arc.id} d={slicePath(cx, cy, outer, inner, arc.start, arc.end)} fill={arc.color}>
              <title>{`${arc.name}: ${arc.used} used, ${arc.percent}%`}</title>
            </path>
          ))
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="400">
          {drawn[0] ? `${drawn[0].percent}%` : "0%"}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="400">
          Most used
        </text>
      </svg>
      <ul className="min-h-0 max-h-[240px] flex-1 space-y-1.5 overflow-y-auto pr-1">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center gap-2">
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
        entry.status !== "scheduled" &&
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
  React.useEffect(() => {
    setCursor(value.slice(0, 7))
  }, [value])
  const month = monthCells(cursor)

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
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="Next month"
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
          const today = cell.iso === STORE_TODAY
          return (
            <button
              key={cell.iso}
              type="button"
              aria-label={labelDate(cell.iso)}
              aria-pressed={selected}
              onClick={() => onChange(cell.iso)}
              className={cn(
                "relative flex h-full min-h-7 items-center justify-center rounded-md text-[11px] font-normal tabular-nums transition-colors duration-150",
                selected
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
        {labelDate(value)}. Every record on or before this day loads across the dashboard.
      </p>
    </div>
  )
}

export function DashboardPage() {
  const { equipment, categories, locations, transactions, activity, maintenance } = useStore()
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [asOf, setAsOf] = React.useState(STORE_TODAY)
  const cutoff = asOf || STORE_TODAY
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

  const stats = [
    {
      label: "Total equipment",
      value: totals.total,
      hint: `On the register ${labelDate(cutoff)}`,
      icon: Package,
    },
    {
      label: "Available",
      value: totals.available,
      hint: "Ready to issue",
      icon: ClipboardCheck,
    },
    {
      label: "Checked out",
      value: totals.issued,
      hint: `${overdue.length} past the expected date`,
      icon: ArrowUpRight,
      tone: "rose" as const,
    },
    {
      label: "Under maintenance",
      value: totals.maintenance,
      hint: "Off the hook for repair",
      icon: Wrench,
    },
  ]

  return (
    <div className="flex min-h-[calc(100vh-6.5rem)] flex-col gap-3">
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
            onChange={setAsOf}
            icon={<Calendar className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className={cn(
                "rounded-lg border p-4 shadow-2xs",
                stat.tone === "rose"
                  ? "border-rose-200 bg-rose-50"
                  : "border-slate-200 bg-white",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-[11px] font-normal", stat.tone === "rose" ? "text-rose-700" : "text-slate-500")}>{stat.label}</p>
                <Icon className={cn("h-4 w-4 shrink-0", stat.tone === "rose" ? "text-rose-600" : "text-slate-400")} strokeWidth={1.75} />
              </div>
              <p className={cn(
                "mt-2 text-[22px] leading-none font-normal tracking-tight tabular-nums",
                stat.tone === "rose" ? "text-rose-700" : "text-slate-900",
              )}>
                {stat.value}
              </p>
              <p className={cn("mt-1 text-[11px]", stat.tone === "rose" ? "text-rose-600" : "text-slate-500")}>{stat.hint}</p>
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
          <TrendCalendar value={cutoff} onChange={setAsOf} marked={marked} />
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
          <ul className="flex min-h-0 flex-1 flex-col divide-y divide-slate-200 overflow-auto">
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
              recent.map((item, index) => (
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
        </Panel>
      </div>

    </div>
  )
}
