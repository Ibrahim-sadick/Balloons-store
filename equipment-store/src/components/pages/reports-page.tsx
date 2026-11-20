"use client"

import * as React from "react"
import Link from "next/link"
import { Download, FileSpreadsheet } from "lucide-react"
import { DateField, PageIntro, Panel } from "@/components/controls"
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
import { downloadXlsx, type ExcelCell } from "@/lib/excel"
import { inRange, isPastDue } from "@/lib/format"
import { countsFor, itemCounts, sumCounts } from "@/lib/stock"
import { useStore } from "@/lib/store"
import { STORE_TODAY } from "@/lib/types"

function maintenanceLabel(status: string) {
  return status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Scheduled"
}

export function ReportsPage() {
  const { equipment, transactions, maintenance, categories, locations } = useStore()
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")

  const stock = itemCounts(equipment, transactions)
  const totals = sumCounts(stock)
  const available = equipment.filter((item) => countsFor(item, transactions).available > 0 && inRange(item.acquiredOn, from, to))
  const out = transactions.filter((item) => !item.returnedOn && inRange(item.issuedOn, from, to))
  const back = transactions.filter((item) => item.returnedOn && inRange(item.returnedOn, from, to))
  const logs = maintenance.filter((item) => inRange(item.openedOn, from, to))

  const assetLabel = (equipmentId: string) => {
    const asset = equipment.find((entry) => entry.id === equipmentId)
    return asset ? `${asset.name} · ${asset.assetTag}` : ""
  }

  const exportSection = (section: string, headers: string[], rows: ExcelCell[][]) => {
    const range = from || to ? `-${from || "start"}-${to || "today"}` : ""
    downloadXlsx(`balons-${section}-${STORE_TODAY}${range}.xlsx`, section, headers, rows)
  }

  const exportAvailable = () =>
    exportSection(
      "available",
      ["Tag", "Equipment", "Category", "Available", "Location", "Serial", "Condition"],
      available.map((item) => [
        item.assetTag,
        item.name,
        categories.find((entry) => entry.id === item.categoryId)?.name ?? "",
        countsFor(item, transactions).available,
        locations.find((entry) => entry.id === item.locationId)?.name ?? "",
        item.serialNumber,
        item.condition,
      ]),
    )

  const exportOut = () =>
    exportSection(
      "out",
      ["Txn", "Asset", "Issued to", "Out", "Due", "Condition", "Status"],
      out.map((item) => [
        item.id,
        assetLabel(item.equipmentId),
        item.issuedTo,
        item.issuedOn,
        item.expectedReturn,
        item.conditionOut,
        isPastDue(item.expectedReturn, STORE_TODAY) ? "Overdue" : "Out",
      ]),
    )

  const exportIn = () =>
    exportSection(
      "in",
      ["Txn", "Asset", "Returned by", "Returned", "Condition", "Status"],
      back.map((item) => [
        item.id,
        assetLabel(item.equipmentId),
        item.returnedBy || item.issuedTo,
        item.returnedOn ?? "",
        item.conditionIn ?? "Pending",
        "Returned",
      ]),
    )

  const exportMaintenance = () =>
    exportSection(
      "maintenance",
      ["Log", "Asset", "Type", "Status", "Opened", "Closed", "Technician"],
      logs.map((item) => [
        item.id,
        assetLabel(item.equipmentId),
        item.type,
        maintenanceLabel(item.status),
        item.openedOn,
        item.completedOn ?? "",
        item.technician,
      ]),
    )

  return (
    <div>
      <PageIntro
        title="Reports"
        description={`${totals.total} on the register. ${totals.available} available, ${totals.issued} still out, ${totals.returned} back, ${totals.maintenance} in maintenance.`}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DateField value={from} onChange={setFrom} />
        <DateField value={to} onChange={setTo} />
        <span className="text-[10px] text-slate-400">Each report exports on its own.</span>
      </div>

      <div className="flex flex-col gap-3">
        <Panel
          title="Available"
          count={available.length}
          action={<ExportButton onClick={exportAvailable} />}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Tag", "Equipment", "Category", "Available", "Location", "Serial", "Condition"].map((label) => (
                  <TableHead key={label} className="h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {available.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={FileSpreadsheet}
                      title="Nothing is available"
                      description={equipment.length === 0 ? "The register is empty." : "No available assets fall in this date range."}
                      action={equipment.length === 0 ? <ReportAction href="/equipment" label="Add equipment" /> : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : available.map((item) => (
                <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.assetTag}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px] font-normal">{item.name}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{categories.find((entry) => entry.id === item.categoryId)?.name}</TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{countsFor(item, transactions).available}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{locations.find((entry) => entry.id === item.locationId)?.name}</TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.serialNumber}</TableCell>
                  <TableCell className="px-3 py-2.5"><ConditionBadge condition={item.condition} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel
          title="Out"
          count={out.length}
          action={<ExportButton onClick={exportOut} />}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Txn", "Asset", "Issued to", "Out", "Due", "Condition", "Status"].map((label) => (
                  <TableHead key={label} className="h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {out.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={FileSpreadsheet}
                      title="Nothing is out"
                      description={transactions.length === 0 ? "No equipment has been issued yet." : out.length === 0 && !from && !to ? "Every issued item has come back." : "No open check-outs fall in this date range."}
                        action={transactions.length === 0 ? <ReportAction href="/transactions" label="Check out" /> : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : out.map((item) => (
                <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.id}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{assetLabel(item.equipmentId)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{item.issuedTo}</TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.issuedOn}</TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.expectedReturn}</TableCell>
                  <TableCell className="px-3 py-2.5"><ConditionBadge condition={item.conditionOut} /></TableCell>
                  <TableCell className="px-3 py-2.5"><CheckoutBadge overdue={isPastDue(item.expectedReturn, STORE_TODAY)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel
          title="In"
          count={back.length}
          action={<ExportButton onClick={exportIn} />}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Txn", "Asset", "Returned by", "Returned", "Condition", "Status"].map((label) => (
                  <TableHead key={label} className="h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {back.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={FileSpreadsheet}
                      title="Nothing has come back"
                      description="Returned assets show here in any condition."
                    />
                  </TableCell>
                </TableRow>
              ) : back.map((item) => (
                <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.id}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{assetLabel(item.equipmentId)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{item.returnedBy || item.issuedTo}</TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.returnedOn}</TableCell>
                  <TableCell className="px-3 py-2.5">{item.conditionIn ? <ConditionBadge condition={item.conditionIn} /> : <span className="text-[10px] text-slate-400">Pending</span>}</TableCell>
                  <TableCell className="px-3 py-2.5"><ReturnedBadge /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel
          title="Maintenance"
          count={logs.length}
          action={<ExportButton onClick={exportMaintenance} />}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Log", "Asset", "Type", "Status", "Opened", "Closed", "Technician"].map((label) => (
                  <TableHead key={label} className="h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
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
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.id}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{assetLabel(item.equipmentId)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{item.type}</TableCell>
                  <TableCell className="px-3 py-2.5"><MaintenanceBadge status={item.status} /></TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.openedOn}</TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{item.completedOn ?? "—"}</TableCell>
                  <TableCell className="px-3 py-2.5 text-[12px]">{item.technician}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  )
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      className="h-6 gap-1 rounded-md border-slate-200 px-2 text-[10px] leading-none text-slate-700"
      onClick={onClick}
    >
      <Download className="h-3 w-3 shrink-0" strokeWidth={1.75} />
      Excel
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
