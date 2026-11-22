"use client"

import * as React from "react"
import Link from "next/link"
import { Download, FileSpreadsheet } from "lucide-react"
import { DateField, PageIntro } from "@/components/controls"
import { DeleteSelectedButton, RowCheckbox, useSelection } from "@/components/delete-selection"
import { EmptyState } from "@/components/empty-state"
import { CheckoutBadge, ConditionBadge, MaintenanceBadge, ReturnedBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { downloadXlsx, type ExcelCell, type ExcelSummary } from "@/lib/excel"
import { inRange, isPastDue } from "@/lib/format"
import { countsFor, itemCounts, sumCounts } from "@/lib/stock"
import { useStore } from "@/lib/store"
import { storeToday, type Condition, type Transaction } from "@/lib/types"

type ReportTab = "available" | "in" | "maintenance" | "out"

function maintenanceLabel(status: string) {
  return status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Scheduled"
}

type OutRecord = {
  id: string
  equipmentId: string
  issuedTo: string
  issuedOn: string
  expectedReturn: string
  conditionOut: Condition
  quantity: number
  returnedQty: number
  returnedOn: string | null
  conditionIn: Condition | null
  open: boolean
}

/**
 * One Out row per check-out for the whole life of that issue: how many units
 * went out, how many came back and the day they came back. The register stops
 * sending the check-out row once it is fully returned, so the returns are folded
 * back in by their `<checkOutId>:<returnId>` prefix — that way checking
 * equipment in never erases its line from the out report.
 */
function outRecords(transactions: Transaction[]): OutRecord[] {
  const groups = new Map<string, Transaction[]>()
  for (const entry of transactions) {
    const key = entry.id.split(":")[0]
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups.entries()].map(([id, group]) => {
    const returned = group
      .filter((entry) => entry.returnedOn)
      .sort((left, right) => (left.returnedOn ?? "").localeCompare(right.returnedOn ?? ""))
    const lastBack = returned[returned.length - 1]
    return {
      id,
      equipmentId: group[0].equipmentId,
      issuedTo: group[0].issuedTo,
      issuedOn: group[0].issuedOn,
      expectedReturn: group[0].expectedReturn,
      conditionOut: group[0].conditionOut,
      quantity: group.reduce((sum, entry) => sum + entry.quantity, 0),
      returnedQty: returned.reduce((sum, entry) => sum + entry.quantity, 0),
      returnedOn: lastBack?.returnedOn ?? null,
      conditionIn: lastBack?.conditionIn ?? null,
      open: group.some((entry) => !entry.returnedOn),
    }
  })
}

const headClass = "h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400"
const cellClass = "px-3 py-2.5 text-[12px] font-normal"
const monoCellClass = "px-3 py-2.5 font-mono text-[11px] tabular-nums"

export function ReportsPage() {
  const { equipment, transactions, maintenance, categories, locations, session, deleteRecords } = useStore()
  const canWrite = session?.role !== "VIEWER"
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [tab, setTab] = React.useState<ReportTab>("available")
  // Ticked boxes belong to one report at a time: switching tabs drops them rather
  // than carrying them into a table where those rows are not even on screen.
  const { selected, toggle, toggleAll, clear } = useSelection()

  const stock = itemCounts(equipment, transactions)
  const totals = sumCounts(stock)
  const available = equipment.filter((item) => countsFor(item, transactions).available > 0 && inRange(item.acquiredOn, from, to))
  const out = outRecords(transactions)
    .filter((item) => inRange(item.issuedOn, from, to))
    .sort((left, right) => right.issuedOn.localeCompare(left.issuedOn))
  const back = transactions.filter((item) => item.returnedOn && inRange(item.returnedOn, from, to))
  const logs = maintenance.filter((item) => inRange(item.openedOn, from, to))

  // Every report names the asset by its tag as well as its name, so a row can be
  // matched to the physical item without reading an internal transaction id.
  const assetTag = (equipmentId: string) => equipment.find((entry) => entry.id === equipmentId)?.assetTag ?? "—"
  const assetName = (equipmentId: string) => equipment.find((entry) => entry.id === equipmentId)?.name ?? ""

  // Only rows on the open report can be ticked, so a tab switch cannot leave a
  // hidden row queued for deletion.
  const rows: { id: string }[] =
    tab === "available" ? available : tab === "in" ? back : tab === "maintenance" ? logs : out
  const picked = selected.filter((id) => rows.some((row) => row.id === id))

  const describe = (id: string) => {
    if (tab === "available") {
      const row = available.find((item) => item.id === id)
      return row ? `${row.assetTag} ${row.name}` : id
    }
    if (tab === "maintenance") {
      const row = logs.find((item) => item.id === id)
      return row ? `${assetTag(row.equipmentId)} ${assetName(row.equipmentId)} · ${row.type}` : id
    }
    if (tab === "out") {
      const row = out.find((item) => item.id === id)
      return row ? `Check out · ${assetTag(row.equipmentId)} ${assetName(row.equipmentId)} · ${row.quantity} · ${row.issuedTo}` : id
    }
    const row = transactions.find((item) => item.id === id)
    if (!row) return id
    const who = row.returnedBy || row.issuedTo
    return `Check in · ${assetTag(row.equipmentId)} ${assetName(row.equipmentId)} · ${who}`
  }

  // Each report removes a different kind of record: available lists the assets
  // themselves, in lists check-ins, out lists whole check-outs (their returns go
  // with them), maintenance lists repair logs.
  const removePicked = () =>
    deleteRecords(tab === "available" ? "equipment" : tab === "maintenance" ? "maintenance" : "movement", picked)

  const warning =
    tab === "available"
      ? "This cannot be undone. Deleting an asset also removes every check-out, check-in and repair log recorded against it."
      : tab === "maintenance"
        ? "This cannot be undone. Deleting a repair that is still in progress puts its units back as available straight away."
        : tab === "out"
          ? "This cannot be undone. Deleting a check-out removes its whole record, including every check-in made against it."
          : "This cannot be undone. Deleting a check-in sends those units back out straight away."

  // Every workbook closes with the same store-wide balance, so one sheet still
  // answers how much the store holds in total.
  const balance: ExcelSummary[] = [
    { label: "Total balance of all assets" },
    { label: "Total on the register", value: totals.total },
    { label: "Available", value: totals.available },
    { label: "Still out", value: totals.issued },
    { label: "Back in", value: totals.returned },
    { label: "In maintenance", value: totals.maintenance },
  ]

  const exportSection = (title: string, section: string, headers: string[], rows: ExcelCell[][]) => {
    const range = from || to ? `-${from || "start"}-${to || "today"}` : ""
    downloadXlsx(`ballons-${section}-${storeToday()}${range}.xlsx`, title, headers, rows, { title, summary: balance })
  }

  const exportAvailable = () =>
    exportSection(
      "Report of Available",
      "available",
      ["Tag", "Equipment", "Category", "Available", "Out", "Maintenance", "Location", "Serial", "Condition"],
      available.map((item) => {
        const counts = countsFor(item, transactions)
        return [
          item.assetTag,
          item.name,
          categories.find((entry) => entry.id === item.categoryId)?.name ?? "",
          counts.available,
          counts.issued,
          counts.maintenance,
          locations.find((entry) => entry.id === item.locationId)?.name ?? "",
          item.serialNumber,
          item.condition,
        ]
      }),
    )

  const exportOut = () =>
    exportSection(
      "Report of Check Out",
      "out",
      ["Tag", "Asset", "Qty", "Issued to", "Out", "Due", "Returned", "Condition out", "Condition in", "Status"],
      out.map((item) => [
        assetTag(item.equipmentId),
        assetName(item.equipmentId),
        item.quantity,
        item.issuedTo,
        item.issuedOn,
        item.expectedReturn,
        item.returnedOn ?? "",
        item.conditionOut,
        item.conditionIn ?? "Pending",
        item.open ? (isPastDue(item.expectedReturn, storeToday()) ? "Overdue" : "Open") : "Returned",
      ]),
    )

  const exportIn = () =>
    exportSection(
      "Report of Check In",
      "in",
      ["Tag", "Asset", "Qty", "Returned by", "Returned", "Condition", "Status"],
      back.map((item) => [
        assetTag(item.equipmentId),
        assetName(item.equipmentId),
        item.quantity,
        item.returnedBy || item.issuedTo,
        item.returnedOn ?? "",
        item.conditionIn ?? "Pending",
        "Returned",
      ]),
    )

  const exportMaintenance = () =>
    exportSection(
      "Report of Maintenance",
      "maintenance",
      ["Tag", "Asset", "Qty", "Type", "Status", "Opened", "Closed", "Technician"],
      logs.map((item) => [
        assetTag(item.equipmentId),
        assetName(item.equipmentId),
        item.quantity,
        item.type,
        maintenanceLabel(item.status),
        item.openedOn,
        item.completedOn ?? "",
        item.technician,
      ]),
    )

  // One tab owns one report, so the Excel button and the row count always follow
  // whatever the operator is looking at.
  const report = {
    available: { label: "Available", count: available.length, exportRows: exportAvailable },
    in: { label: "In", count: back.length, exportRows: exportIn },
    maintenance: { label: "Maintenance", count: logs.length, exportRows: exportMaintenance },
    out: { label: "Out", count: out.length, exportRows: exportOut },
  } satisfies Record<ReportTab, { label: string; count: number; exportRows: () => void }>

  const active = report[tab]

  return (
    <div>
      <PageIntro
        title="Reports"
        description={`${totals.total} on the register. ${totals.available} available, ${totals.issued} still out, ${totals.returned} back, ${totals.maintenance} in maintenance.`}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DateField value={from} onChange={setFrom} />
        <DateField value={to} onChange={setTo} />
        <span className="text-[10px] text-slate-400">Pick a tab, then export only that report.</span>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value !== tab) clear()
          setTab(value as ReportTab)
        }}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <TabsList className="min-h-10 gap-0.5 rounded-lg p-1">
            <TabsTrigger value="available" className="min-w-[92px] px-4 text-[13px]">
              Available
            </TabsTrigger>
            <TabsTrigger value="in" className="min-w-[92px] px-4 text-[13px]">
              In
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="min-w-[92px] px-4 text-[13px]">
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="out" className="min-w-[92px] px-4 text-[13px]">
              Out
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">
              {active.label} · {active.count} {active.count === 1 ? "row" : "rows"}
            </span>
            <DeleteSelectedButton
              count={picked.length}
              labels={picked.map(describe)}
              title="Delete"
              warning={warning}
              disabled={!canWrite}
              onConfirm={removePicked}
              onClear={clear}
            />
            <ExportButton onClick={active.exportRows} />
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {/* Only the chosen report is mounted. base-ui keeps every panel in
              the DOM with these tabs, which would stack all four tables. */}
          {tab === "available" ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${headClass} w-8 pr-0`}>
                    <RowCheckbox
                      checked={rows.length > 0 && picked.length === rows.length}
                      onChange={() => toggleAll(rows.map((item) => item.id))}
                      label="Select every asset in this report"
                      disabled={!canWrite || rows.length === 0}
                    />
                  </TableHead>
                  {["Tag", "Equipment", "Category", "Available", "Out", "Maintenance", "Location", "Serial", "Condition"].map((label) => (
                    <TableHead key={label} className={headClass}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {available.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <EmptyState
                        icon={FileSpreadsheet}
                        title="Nothing is available"
                        description={equipment.length === 0 ? "The register is empty." : "No available assets fall in this date range."}
                        action={equipment.length === 0 ? <ReportAction href="/equipment" label="Add equipment" /> : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : available.map((item) => {
                  // One read of the ledger per row feeds all four counters, so
                  // available + out + maintenance always add up to the total.
                  const counts = countsFor(item, transactions)
                  return (
                    <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="w-8 px-3 py-2.5">
                        <RowCheckbox
                          checked={selected.includes(item.id)}
                          onChange={() => toggle(item.id)}
                          label={`Select ${item.assetTag} ${item.name}`}
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className={monoCellClass}>{item.assetTag}</TableCell>
                      <TableCell className={cellClass}>{item.name}</TableCell>
                      <TableCell className={cellClass}>{categories.find((entry) => entry.id === item.categoryId)?.name}</TableCell>
                      <TableCell className={monoCellClass}>{counts.available}</TableCell>
                      <TableCell className={monoCellClass}>{counts.issued}</TableCell>
                      <TableCell className={monoCellClass}>{counts.maintenance}</TableCell>
                      <TableCell className={cellClass}>{locations.find((entry) => entry.id === item.locationId)?.name}</TableCell>
                      <TableCell className={monoCellClass}>{item.serialNumber}</TableCell>
                      <TableCell className="px-3 py-2.5"><ConditionBadge condition={item.condition} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : null}

          {tab === "in" ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${headClass} w-8 pr-0`}>
                    <RowCheckbox
                      checked={rows.length > 0 && picked.length === rows.length}
                      onChange={() => toggleAll(rows.map((item) => item.id))}
                      label="Select every check-in in this report"
                      disabled={!canWrite || rows.length === 0}
                    />
                  </TableHead>
                  {["Tag", "Asset", "Qty", "Returned by", "Returned", "Condition", "Status"].map((label) => (
                    <TableHead key={label} className={headClass}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {back.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        icon={FileSpreadsheet}
                        title="Nothing has come back"
                        description="Returned assets show here in any condition."
                      />
                    </TableCell>
                  </TableRow>
                ) : back.map((item) => (
                  <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                    <TableCell className="w-8 px-3 py-2.5">
                      <RowCheckbox
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        label={`Select the check in of ${item.quantity} ${assetName(item.equipmentId)} on ${item.returnedOn}`}
                        disabled={!canWrite}
                      />
                    </TableCell>
                    <TableCell className={monoCellClass}>{assetTag(item.equipmentId)}</TableCell>
                    <TableCell className={cellClass}>{assetName(item.equipmentId)}</TableCell>
                    <TableCell className={monoCellClass}>{item.quantity}</TableCell>
                    <TableCell className={cellClass}>{item.returnedBy || item.issuedTo}</TableCell>
                    <TableCell className={monoCellClass}>{item.returnedOn}</TableCell>
                    <TableCell className="px-3 py-2.5">{item.conditionIn ? <ConditionBadge condition={item.conditionIn} /> : <span className="text-[10px] text-slate-400">Pending</span>}</TableCell>
                    <TableCell className="px-3 py-2.5"><ReturnedBadge /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {tab === "maintenance" ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${headClass} w-8 pr-0`}>
                    <RowCheckbox
                      checked={rows.length > 0 && picked.length === rows.length}
                      onChange={() => toggleAll(rows.map((item) => item.id))}
                      label="Select every maintenance log in this report"
                      disabled={!canWrite || rows.length === 0}
                    />
                  </TableHead>
                  {["Tag", "Asset", "Qty", "Type", "Status", "Opened", "Closed", "Technician"].map((label) => (
                    <TableHead key={label} className={headClass}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState
                        icon={FileSpreadsheet}
                        title="No maintenance rows"
                        description={maintenance.length === 0 ? "No repair or calibration has been logged." : "No logs were opened in this date range."}
                        action={maintenance.length === 0 ? <ReportAction href="/maintenance" label="Log maintenance" /> : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : logs.map((item) => (
                  <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                    <TableCell className="w-8 px-3 py-2.5">
                      <RowCheckbox
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        label={`Select the ${item.type} log for ${assetTag(item.equipmentId)} on ${item.openedOn}`}
                        disabled={!canWrite}
                      />
                    </TableCell>
                    <TableCell className={monoCellClass}>{assetTag(item.equipmentId)}</TableCell>
                    <TableCell className={cellClass}>{assetName(item.equipmentId)}</TableCell>
                    <TableCell className={monoCellClass}>{item.quantity}</TableCell>
                    <TableCell className={cellClass}>{item.type}</TableCell>
                    <TableCell className="px-3 py-2.5"><MaintenanceBadge status={item.status} /></TableCell>
                    <TableCell className={monoCellClass}>{item.openedOn}</TableCell>
                    <TableCell className={monoCellClass}>{item.completedOn ?? "—"}</TableCell>
                    <TableCell className={cellClass}>{item.technician}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {tab === "out" ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${headClass} w-8 pr-0`}>
                    <RowCheckbox
                      checked={rows.length > 0 && picked.length === rows.length}
                      onChange={() => toggleAll(rows.map((item) => item.id))}
                      label="Select every check-out in this report"
                      disabled={!canWrite || rows.length === 0}
                    />
                  </TableHead>
                  {["Tag", "Asset", "Qty", "Issued to", "Out", "Due", "Returned", "Condition", "Status"].map((label) => (
                    <TableHead key={label} className={headClass}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {out.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <EmptyState
                        icon={FileSpreadsheet}
                        title="No check-outs recorded"
                        description={transactions.length === 0 ? "No equipment has been issued yet." : "No check-out was issued in this date range."}
                        action={transactions.length === 0 ? <ReportAction href="/transactions" label="Check out" /> : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : out.map((item) => (
                  <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                    <TableCell className="w-8 px-3 py-2.5">
                      <RowCheckbox
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        label={`Select the check out of ${item.quantity} ${assetName(item.equipmentId)} to ${item.issuedTo}`}
                        disabled={!canWrite}
                      />
                    </TableCell>
                    <TableCell className={monoCellClass}>{assetTag(item.equipmentId)}</TableCell>
                    <TableCell className={cellClass}>{assetName(item.equipmentId)}</TableCell>
                    <TableCell className={monoCellClass}>{item.quantity}</TableCell>
                    <TableCell className={cellClass}>{item.issuedTo}</TableCell>
                    <TableCell className={monoCellClass}>{item.issuedOn}</TableCell>
                    <TableCell className={monoCellClass}>{item.expectedReturn}</TableCell>
                    <TableCell className={monoCellClass}>{item.returnedOn ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <ConditionBadge condition={item.conditionOut} />
                        <span className="text-slate-400">→</span>
                        {item.conditionIn ? <ConditionBadge condition={item.conditionIn} /> : <span className="text-[10px] font-normal text-slate-400">Pending</span>}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      {item.open ? <CheckoutBadge overdue={isPastDue(item.expectedReturn, storeToday())} /> : <ReturnedBadge />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </section>
      </Tabs>
    </div>
  )
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      className="h-8 gap-1.5 rounded-md bg-emerald-600 px-3 text-[11px] leading-none font-normal whitespace-nowrap text-white shadow-2xs hover:bg-emerald-700 focus-visible:border-emerald-700 focus-visible:ring-emerald-600/30"
      onClick={onClick}
    >
      <Download className="size-3.5 shrink-0" strokeWidth={1.75} />
      Export Excel
    </Button>
  )
}

function ReportAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-7 items-center rounded-full bg-emerald-600 px-3.5 text-[10px] leading-none font-normal whitespace-nowrap text-white hover:bg-emerald-700"
    >
      {label}
    </Link>
  )
}
