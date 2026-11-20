"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Plus, Wrench } from "lucide-react"
import {
  DateField,
  EmeraldButton,
  PillButton,
  FilterSelect,
  PageIntro,
} from "@/components/controls"
import { EmptyState } from "@/components/empty-state"
import {
  CompleteMaintenanceDialog,
  LogMaintenanceDialog,
} from "@/components/dialogs/maintenance-dialogs"
import { MaintenanceBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { openMaintenanceQty } from "@/lib/stock"
import { useStore } from "@/lib/store"
import type { MaintenanceLog, MaintenanceType } from "@/lib/types"

const maintenanceTypes: MaintenanceType[] = ["Inspection", "Calibration", "Repair", "Service", "Gas refill"]

export function MaintenancePage() {
  const searchParams = useSearchParams()
  const { maintenance, equipment, session } = useStore()
  const canWrite = session?.role !== "VIEWER"
  const [status, setStatus] = React.useState("all")
  const [typeFilter, setTypeFilter] = React.useState<"all" | MaintenanceType>("all")
  const [openedOn, setOpenedOn] = React.useState("")
  const [logOpen, setLogOpen] = React.useState(false)
  const [closing, setClosing] = React.useState<MaintenanceLog | null>(null)

  const assetId = searchParams.get("asset")
  const focused = equipment.find((item) => item.id === assetId) ?? null

  React.useEffect(() => {
    const next = searchParams.get("status")
    setStatus(next === "scheduled" || next === "in_progress" || next === "completed" ? next : "all")
  }, [searchParams])

  const rows = maintenance.filter((log) => {
    if (assetId && log.equipmentId !== assetId) return false
    if (status !== "all" && log.status !== status) return false
    if (typeFilter !== "all" && log.type !== typeFilter) return false
    if (openedOn && log.openedOn !== openedOn) return false
    return true
  })
  return (
    <div>
      <PageIntro
        title="Maintenance"
        description={
          focused
            ? `${openMaintenanceQty(focused.id, maintenance)} ${focused.name} in maintenance.`
            : "Repairs, calibrations, and inspections that take a tool off the hook."
        }
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as "all" | MaintenanceType)}
            options={[
              { value: "all", label: "Total" },
              ...maintenanceTypes.map((type) => ({ value: type, label: type })),
            ]}
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All statuses" },
              { value: "scheduled", label: "Scheduled" },
              { value: "in_progress", label: "In progress" },
              { value: "completed", label: "Completed" },
            ]}
          />
          <DateField value={openedOn} onChange={setOpenedOn} />
        </div>
        <EmeraldButton disabled={!canWrite} onClick={() => setLogOpen(true)}>
          <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Log maintenance
        </EmeraldButton>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Log", "Asset", "Number", "Category", "Status", "Opened", "Closed", "Technician", "Notes", ""].map((label) => (
                <TableHead key={label || "action"} className="h-9 bg-slate-50 px-3 text-[10px] font-normal text-slate-400">
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10}>
                  {maintenance.length === 0 ? (
                    <EmptyState
                      icon={Wrench}
                      title="No maintenance logged yet"
                      description="Inspections, calibrations, and repairs will be listed here."
                      action={
                        <PillButton disabled={!canWrite} onClick={() => setLogOpen(true)}>
                          Log maintenance
                        </PillButton>
                      }
                    />
                  ) : (
                    <p className="px-3 py-8 text-center text-[12px] text-slate-500">
                      No maintenance logs match these filters.
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((log) => {
                const asset = equipment.find((entry) => entry.id === log.equipmentId)
                return (
                  <TableRow key={log.id} className="border-slate-200 hover:bg-slate-50">
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{log.id}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-[12px] font-normal text-slate-900">{asset?.name}</span>
                      <p className="font-mono text-[10px] tabular-nums text-slate-500">{asset?.assetTag}</p>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-900">{log.quantity ?? 1}</TableCell>
                    <TableCell className="px-3 py-2.5 text-[12px]">{log.type}</TableCell>
                    <TableCell className="px-3 py-2.5"><MaintenanceBadge status={log.status} /></TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{log.openedOn}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{log.completedOn ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2.5 text-[12px]">{log.technician}</TableCell>
                    <TableCell className="max-w-[240px] px-3 py-2.5 text-[12px] whitespace-normal text-slate-600">{log.notes}</TableCell>
                    <TableCell className="px-3 py-2.5 text-right">
                      {log.status === "completed" ? (
                        <span className="text-[11px] text-slate-400">Closed</span>
                      ) : (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="rounded-md"
                          disabled={!canWrite}
                          onClick={() => setClosing(log)}
                        >
                          Mark completed
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </section>

      <LogMaintenanceDialog open={logOpen} onOpenChange={setLogOpen} />
      <CompleteMaintenanceDialog
        log={closing}
        open={closing !== null}
        onOpenChange={(open) => {
          if (!open) setClosing(null)
        }}
      />
    </div>
  )
}
