"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeftRight, Eye, Plus, X } from "lucide-react"
import {
  DateField,
  EmeraldButton,
  FilterSelect,
  PageIntro,
  SearchField,
} from "@/components/controls"
import { EmptyState } from "@/components/empty-state"
import { DeleteSelectedButton, RowCheckbox, useSelection } from "@/components/delete-selection"
import { IssueEquipmentDialog } from "@/components/dialogs/equipment-dialogs"
import { ReturnItemDialog } from "@/components/dialogs/return-dialog"
import { ConditionBadge, DirectionBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useStore } from "@/lib/store"
import { useSyncedState } from "@/hooks/use-synced-state"
import type { Condition, Equipment, Transaction } from "@/lib/types"

const headClass = "h-8 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400"
const cellClass = "px-3 py-2 text-[11px] font-normal text-slate-700"
const monoClass = "px-3 py-2 font-mono text-[11px] font-normal tabular-nums text-slate-700"

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-b border-slate-200 py-1.5 pr-4">
      <dt className="text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 flex min-h-[18px] flex-wrap items-center gap-1 break-words text-[11px] font-normal text-slate-700">{children}</dd>
    </div>
  )
}

type MovementRow = {
  key: string
  asset?: Equipment
  entries: Transaction[]
  outQty: number
  inQty: number
  outside: number
  openEntry?: Transaction
  lastOut: string
  dueOrBack: string
  lastReturned: string | null
  conditionOut: Condition
  conditionIn: Condition | null
  recipients: string
  issuedBy: string
  damageNoted: boolean
  notes: string
  history: MovementEvent[]
}

type MovementEvent = {
  key: string
  direction: "IN" | "OUT"
  date: string
  quantity: number
  person: string
  condition: Condition
  notes: string
  detail: string
}

/**
 * The register folds one line per equipment, which hides how often the item
 * actually moved. The detail panel puts the history back together from those
 * same rows: a check-out is the sum of its rows (an open row carries only what
 * is still outside) and every return is a row of its own, so three returns read
 * as three dated lines, each with its own receiver, condition and note.
 */
function movementHistory(entries: Transaction[]): MovementEvent[] {
  const checkouts = new Map<string, Transaction[]>()
  for (const entry of entries) {
    // Return rows are ided "<checkOutId>:<returnId>".
    const checkoutId = entry.id.split(":")[0]
    checkouts.set(checkoutId, [...(checkouts.get(checkoutId) ?? []), entry])
  }

  const events: MovementEvent[] = []
  for (const [checkoutId, group] of checkouts) {
    const anchor = group[0]
    const openRow = group.find((entry) => !entry.returnedOn)
    events.push({
      key: `out:${checkoutId}`,
      direction: "OUT",
      date: anchor.issuedOn,
      quantity: group.reduce((sum, entry) => sum + entry.quantity, 0),
      person: anchor.issuedTo,
      condition: anchor.conditionOut,
      // The register keeps the check-out note; the DTO appends the return note
      // to it as " Return: ..." on the check-in rows only.
      notes: (openRow ?? anchor).notes.split(" Return: ")[0],
      detail: `Issued by ${anchor.issuedBy} · due ${anchor.expectedReturn}`,
    })
    for (const entry of group) {
      if (!entry.returnedOn) continue
      events.push({
        key: entry.id,
        direction: "IN",
        date: entry.returnedOn,
        quantity: entry.quantity,
        person: entry.returnedBy || "—",
        condition: entry.conditionIn ?? anchor.conditionOut,
        notes: entry.notes.split(" Return: ").slice(1).join(" Return: "),
        detail: entry.damageNoted ? "Returned damaged" : "Returned to stock",
      })
    }
  }

  // One timeline for the equipment: out before in on the same day, so the pair
  // that happened together never reads backwards.
  return events.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      (left.direction === right.direction ? 0 : left.direction === "OUT" ? -1 : 1),
  )
}

/**
 * Folds the movement ledger into one line per equipment. "Out" is everything
 * that ever left, "In" is everything that came back, and the gap between them is
 * what is still outside — so a product that moved three times still takes one
 * row and the rest of the list stays visible.
 */
function groupMovements(entries: Transaction[], equipment: Equipment[]): MovementRow[] {
  const groups = new Map<string, Transaction[]>()
  for (const entry of entries) {
    groups.set(entry.equipmentId, [...(groups.get(entry.equipmentId) ?? []), entry])
  }
  return [...groups.entries()].map(([key, group]) => {
    const byOut = [...group].sort((left, right) => left.issuedOn.localeCompare(right.issuedOn))
    const latest = byOut[byOut.length - 1]
    const open = group.filter((entry) => !entry.returnedOn)
    const returned = group
      .filter((entry) => entry.returnedOn)
      .sort((left, right) => (left.returnedOn ?? "").localeCompare(right.returnedOn ?? ""))
    const lastBack = returned[returned.length - 1]
    return {
      key,
      asset: equipment.find((item) => item.id === key),
      entries: group,
      outQty: group.reduce((sum, entry) => sum + entry.quantity, 0),
      inQty: returned.reduce((sum, entry) => sum + entry.quantity, 0),
      outside: open.reduce((sum, entry) => sum + entry.quantity, 0),
      openEntry: open[0],
      lastOut: latest.issuedOn,
      // While units are still out the row shows the earliest promise date; once
      // everything is back it shows the day the last units came in.
      dueOrBack:
        open.length > 0
          ? [...open].sort((left, right) => left.expectedReturn.localeCompare(right.expectedReturn))[0].expectedReturn
          : (lastBack?.returnedOn ?? ""),
      lastReturned: lastBack?.returnedOn ?? null,
      conditionOut: latest.conditionOut,
      conditionIn: lastBack?.conditionIn ?? null,
      recipients: [...new Set(group.map((entry) => entry.issuedTo))].join(" · "),
      issuedBy: [...new Set(group.map((entry) => entry.issuedBy))].join(" · "),
      damageNoted: group.some((entry) => entry.damageNoted),
      notes: [...group].reverse().find((entry) => entry.notes)?.notes ?? "",
      history: movementHistory(group),
    }
  })
}

/**
 * Everything recorded for one equipment, unfolded in place. The record opens as
 * a second row directly beneath the row whose eye was tapped and pushes the
 * rows under it down, so the item above and the item below stay on screen while
 * the movement is read where it happened.
 */
function MovementPanel({ row, onClose }: { row: MovementRow; onClose: () => void }) {
  const { categories, locations } = useStore()
  const asset = row.asset
  const category = categories.find((entry) => entry.id === asset?.categoryId)
  const location = locations.find((entry) => entry.id === asset?.locationId)
  const outs = row.history.filter((event) => event.direction === "OUT").length
  const ins = row.history.length - outs

  return (
    <div className="whitespace-normal bg-slate-50">
      <div className="flex items-start justify-between gap-2 px-5 pt-3 pb-2">
        <div className="min-w-0">
          <p className="text-[13px] font-normal text-slate-900">{asset?.name ?? "Equipment"}</p>
          <p className="text-[11px] font-normal text-slate-500">
            {asset?.assetTag ?? "—"} · {row.outside > 0 ? `${row.outside} still outside` : "every unit is back"}
          </p>
        </div>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-7 shrink-0 rounded-md px-1.5 text-slate-500"
          aria-label={`Close the record for ${asset?.name ?? "this equipment"}`}
          title="Close"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </Button>
      </div>
      <div className="px-5 pb-4">
        {/* Every reading carries a rule under it: with no column gap the lines
            join into one separator across each row of the grid, so the details
            above the history are read row by row like the history itself. */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <Detail label="Asset tag">{asset?.assetTag ?? "—"}</Detail>
          <Detail label="Serial number">{asset?.serialNumber || "—"}</Detail>
          <Detail label="Category">{category?.name ?? "—"}</Detail>
          <Detail label="Stored at">{location?.name ?? "—"}</Detail>
          <Detail label="Movements">{row.entries.length}</Detail>
          <Detail label="Still outside">{row.outside}</Detail>
          <Detail label="Total out">{row.outQty}</Detail>
          <Detail label="Total in">{row.inQty}</Detail>
          <Detail label="Issued to">{row.recipients || "—"}</Detail>
          <Detail label="Issued by">{row.issuedBy || "—"}</Detail>
          <Detail label="Last out">{row.lastOut}</Detail>
          <Detail label="Due back">{row.openEntry?.expectedReturn ?? "—"}</Detail>
          <Detail label="Last returned">{row.lastReturned ?? "Not yet"}</Detail>
          <Detail label="Damage noted">{row.damageNoted ? "Yes" : "No"}</Detail>
          <Detail label="Condition out">
            <ConditionBadge condition={row.conditionOut} />
          </Detail>
          <Detail label="Condition in">
            {row.conditionIn ? <ConditionBadge condition={row.conditionIn} /> : <span className="text-slate-400">Pending</span>}
          </Detail>
          <div className="col-span-full border-b border-slate-200 py-1.5">
            <dt className="text-[10px] font-normal uppercase tracking-wider text-slate-400">Latest notes</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words text-[11px] font-normal text-slate-700">{row.notes || "—"}</dd>
          </div>
        </dl>
        {/* Every movement in and out, in the order it happened: one check-out
            line plus one line per return, so an item that came back three times
            shows three dated returns with their own receiver and condition. */}
        <div className="mt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="text-[10px] font-normal tracking-wider text-slate-400 uppercase">Movement history</p>
            <p className="font-mono text-[10px] font-normal tabular-nums text-slate-400">
              {outs} out · {ins} in
            </p>
          </div>
          {/* Each movement keeps its own line, ruled off from the one above it:
              a return and the check-out it answers are different acts and are not
              read as one block. */}
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[680px] text-[11px]">
              <thead>
                <tr className="border-b border-slate-200">
                  {["#", "Movement date", "Type", "Qty", "Equipment", "Name", "Condition", "Notes"].map((label) => (
                    <th
                      key={label}
                      className={`px-2 py-1.5 text-[10px] font-normal tracking-wider text-slate-400 uppercase ${label === "Qty" ? "text-right" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.history.map((event, index) => (
                  <tr key={event.key} className="border-b border-slate-200 last:border-b-0">
                    <td className="w-8 px-2 py-1.5 align-middle font-mono text-[10px] tabular-nums text-slate-400">{index + 1}</td>
                    <td className="px-2 py-1.5 align-middle whitespace-nowrap font-mono text-[11px] tabular-nums text-slate-700">{event.date}</td>
                    <td className="w-16 px-2 py-1.5 align-middle">
                      <DirectionBadge direction={event.direction} />
                    </td>
                    <td className="w-14 px-2 py-1.5 text-right align-middle font-mono text-[11px] tabular-nums text-slate-700">{event.quantity}</td>
                    <td className="max-w-[190px] px-2 py-1.5 align-middle text-[11px] text-slate-700">
                      <span className="block truncate" title={asset?.name}>{asset?.name ?? "—"}</span>
                    </td>
                    <td className="max-w-[150px] px-2 py-1.5 align-middle text-[11px] text-slate-700">
                      <span className="block truncate" title={event.person}>{event.person || "—"}</span>
                    </td>
                    <td className="w-24 px-2 py-1.5 align-middle">
                      <ConditionBadge condition={event.condition} />
                    </td>
                    <td className="px-2 py-1.5 align-middle text-[11px] text-slate-500">
                      <span className="block truncate" title={event.notes || event.detail}>{event.notes || event.detail}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// The record is stepped open in frames rather than handed to a CSS transition:
// this app clamps transitions to a hair when a machine asks for reduced motion,
// and a panel that snaps open reads as a jump-cut.
const DROP_MS = 260

/**
 * The record's height, walked open and shut. The panel itself stays in the
 * document at every moment — it is the box around it that is measured and
 * stepped — so the drop starts from wherever the last movement left it, even
 * when the eye is tapped twice in the middle of one.
 */
function MovementDrop({ open, children }: { open: boolean; children: React.ReactNode }) {
  const boxRef = React.useRef<HTMLDivElement>(null)
  const innerRef = React.useRef<HTMLDivElement>(null)

  // Shut in the ref, which runs before the browser paints: a record must never
  // be glimpsed open on the frame the page arrives.
  const shutRef = React.useCallback((node: HTMLDivElement | null) => {
    boxRef.current = node
    if (node && !node.style.height) node.style.height = "0px"
  }, [])

  React.useEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return

    const from = box.getBoundingClientRect().height
    const to = open ? inner.getBoundingClientRect().height : 0
    if (Math.abs(to - from) < 1) {
      box.style.height = open ? "auto" : "0px"
      return
    }

    box.style.height = `${from}px`
    const started = performance.now()
    let frame = window.requestAnimationFrame(function step(now: number) {
      const walked = Math.min(1, (now - started) / DROP_MS)
      // Ease out: quick off the row, settling into place rather than creeping.
      const eased = 1 - (1 - walked) ** 3
      box.style.height = `${from + (to - from) * eased}px`
      if (walked < 1) frame = window.requestAnimationFrame(step)
      else box.style.height = open ? "auto" : "0px"
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  return (
    <div ref={shutRef} className="overflow-hidden">
      <div ref={innerRef} aria-hidden={!open}>
        {children}
      </div>
    </div>
  )
}

export function TransactionsPage() {
  const searchParams = useSearchParams()
  const { transactions, equipment, session, deleteRecords } = useStore()
  const canWrite = session?.role !== "VIEWER"
  const assetId = searchParams.get("asset") ?? ""
  const [query, setQuery] = useSyncedState(searchParams.get("q") ?? "")
  const [direction, setDirection] = React.useState("all")
  const [onDate, setOnDate] = React.useState("")
  const [issueOpen, setIssueOpen] = React.useState(false)
  const [returnOpen, setReturnOpen] = React.useState(false)
  const [returning, setReturning] = React.useState<Transaction | null>(null)
  // The eye opens one equipment directly under its own row, so the list stays
  // the list and the whole record is read one product after another without
  // leaving the register.
  const [detailKey, setDetailKey] = React.useState<string | null>(null)
  // Delete works from ticked boxes, so nothing can be removed by a stray click
  // in the row itself.
  const { selected, toggle, toggleAll, clear } = useSelection()

  const focused = equipment.find((item) => item.id === assetId)
  const scoped = assetId ? transactions.filter((item) => item.equipmentId === assetId) : transactions
  const totalOut = scoped.reduce((sum, item) => sum + item.quantity, 0)
  const totalIn = scoped.filter((item) => item.returnedOn).reduce((sum, item) => sum + item.quantity, 0)
  const currentlyOutside = scoped.filter((item) => !item.returnedOn).reduce((sum, item) => sum + item.quantity, 0)

  const matchesFilters = (item: Transaction) => {
    const asset = equipment.find((entry) => entry.id === item.equipmentId)
    const haystack = [asset?.name, asset?.serialNumber, item.issuedTo, item.returnedBy, item.notes]
      .join(" ")
      .toLowerCase()
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
    if (direction === "out" && item.returnedOn) return false
    if (direction === "in" && !item.returnedOn) return false
    if (onDate && item.issuedOn !== onDate && item.returnedOn !== onDate) return false
    return true
  }

  // The filters decide which equipment rows show; the Out/In numbers on a row
  // stay whole, so a row never reports half of its own history.
  const rows = groupMovements(scoped, equipment).filter((row) => row.entries.some(matchesFilters))

  // Only rows still on screen count, so a filter cannot leave a hidden row queued.
  const picked = selected.filter((id) => rows.some((row) => row.key === id))
  // Ticking an equipment row stands for every movement recorded for that equipment.
  const pickedEntries = rows
    .filter((row) => picked.includes(row.key))
    .flatMap((row) => row.entries.map((entry) => entry.id))
  const describe = (id: string) => {
    const row = rows.find((entry) => entry.key === id)
    if (!row) return id
    return `${row.asset?.assetTag ?? "—"} ${row.asset?.name ?? ""} · ${row.inQty} of ${row.outQty} back`
  }

  return (
    <div>
      <PageIntro
        title="Check In & Check Out"
        description={focused ? `${focused.name} check in and check out.` : "One list of what left the cage and what came back."}
      />
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-3 py-2 text-[11px] font-normal text-slate-500">
          <span>Total Out: <span className="font-mono text-[11px] font-normal tabular-nums text-slate-700">{totalOut}</span></span>
          <span className="text-slate-300">|</span>
          <span>Total In: <span className="font-mono text-[11px] font-normal tabular-nums text-slate-700">{totalIn}</span></span>
          <span className="text-slate-300">|</span>
          <span>Currently Outside: <span className="font-mono text-[11px] font-normal tabular-nums text-slate-700">{currentlyOutside}</span></span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchField value={query} onChange={setQuery} placeholder="Item, note, or recipient" />
            <FilterSelect
              value={direction}
              onChange={setDirection}
              options={[
                { value: "all", label: "All" },
                { value: "out", label: "Out" },
                { value: "in", label: "In" },
              ]}
            />
            <DateField value={onDate} onChange={setOnDate} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DeleteSelectedButton
              count={picked.length}
              labels={picked.map(describe)}
              title="Delete"
              warning="This cannot be undone. Deleting an equipment row removes every check-out and check-in recorded for it, so its units count as never issued."
              disabled={!canWrite}
              onConfirm={() => deleteRecords("movement", pickedEntries)}
              onClear={() => {
                clear()
                setDetailKey(null)
              }}
            />
            <EmeraldButton disabled={!canWrite} onClick={() => setIssueOpen(true)}>
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Check Out (Issue)
            </EmeraldButton>
            <EmeraldButton disabled={!canWrite || currentlyOutside === 0} onClick={() => { setReturning(null); setReturnOpen(true) }}>
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Check In (Return)
            </EmeraldButton>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${headClass} w-8 pr-0`}>
                <RowCheckbox
                  checked={rows.length > 0 && picked.length === rows.length}
                  onChange={() => toggleAll(rows.map((row) => row.key))}
                  label="Select every equipment in this list"
                  disabled={!canWrite || rows.length === 0}
                />
              </TableHead>
              {["Direction", "Equipment", "Out", "In", "Issued to", "Date out", "Due / returned", "Condition", "Notes", ""].map((label) => (
                <TableHead key={label || "action"} className={headClass}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11}>
                  <EmptyState
                    icon={ArrowLeftRight}
                    title={transactions.length === 0 ? "No movement yet" : "Nothing matches these filters"}
                    description={transactions.length === 0 ? "Check equipment out when it leaves, and check it in when it comes back." : "Try another name, note, or date."}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const asset = row.asset
                const allBack = row.outside === 0
                return (
                  <React.Fragment key={row.key}>
                    <TableRow className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="w-8 px-3 py-2">
                        <RowCheckbox
                          checked={selected.includes(row.key)}
                          onChange={() => toggle(row.key)}
                          label={`Select every movement of ${asset?.name ?? "equipment"}`}
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className={cellClass}>
                        <DirectionBadge direction={allBack ? "IN" : "OUT"} />
                      </TableCell>
                      <TableCell className={cellClass}>
                        <span className="text-slate-900">{asset?.name}</span>
                      </TableCell>
                      <TableCell className={monoClass}>{row.outQty}</TableCell>
                      <TableCell className={monoClass}>{row.inQty}</TableCell>
                      <TableCell className={cellClass}>{row.recipients}</TableCell>
                      <TableCell className={monoClass}>{row.lastOut}</TableCell>
                      <TableCell className={monoClass}>{row.dueOrBack}</TableCell>
                      <TableCell className={cellClass}>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <ConditionBadge condition={row.conditionOut} />
                          <span className="text-slate-400">→</span>
                          {row.conditionIn ? <ConditionBadge condition={row.conditionIn} /> : <span className="text-[11px] font-normal text-slate-400">Pending</span>}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px] px-3 py-2 text-[11px] font-normal text-slate-600">
                        <span className="block truncate" title={row.notes || undefined}>{row.notes || "—"}</span>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1">
                          {allBack ? null : (
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              className="h-7 rounded-md px-2 text-[11px] font-normal text-slate-600"
                              disabled={!canWrite}
                              onClick={() => {
                                setReturning(row.openEntry ?? null)
                                setReturnOpen(true)
                              }}
                            >
                              Check In
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="h-7 rounded-md px-1.5 text-slate-500"
                            aria-expanded={detailKey === row.key}
                            aria-label={`${detailKey === row.key ? "Close" : "Open"} every recorded detail for ${asset?.name ?? "this equipment"}`}
                            title={detailKey === row.key ? "Hide the record" : "See every detail"}
                            onClick={() => setDetailKey((current) => (current === row.key ? null : row.key))}
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                    {/* The record itself, as the row straight under the tapped
                        one: it rolls down and pushes the rest of the register
                        with it, so the equipment above stays in view and
                        nothing is covered. */}
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={11} className="p-0">
                        <MovementDrop open={detailKey === row.key}>
                          <MovementPanel row={row} onClose={() => setDetailKey(null)} />
                        </MovementDrop>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </section>

      <IssueEquipmentDialog open={issueOpen} onOpenChange={setIssueOpen} />
      <ReturnItemDialog
        transaction={returning}
        open={returnOpen}
        onOpenChange={(open) => {
          setReturnOpen(open)
          if (!open) setReturning(null)
        }}
      />
    </div>
  )
}
