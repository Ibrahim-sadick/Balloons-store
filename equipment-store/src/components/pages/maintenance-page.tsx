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
import { DeleteSelectedButton, RowCheckbox, useSelection } from "@/components/delete-selection"
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
import { useSyncedState } from "@/hooks/use-synced-state"
import type { MaintenanceLog, MaintenanceType } from "@/lib/types"

const maintenanceTypes: MaintenanceType[] = ["Inspection", "Calibration", "Repair", "Service", "Gas refill"]

export function MaintenancePage() {
  const searchParams = useSearchParams()
  const { maintenance, equipment, session, deleteRecords } = useStore()
  const canWrite = session?.role !== "VIEWER"
  const [status, setStatus] = useSyncedState(
    searchParams.get("status") === "scheduled" ||
      searchParams.get("status") === "in_progress" ||
      searchParams.get("status") === "completed"
      ? String(searchParams.get("status"))
      : "all",
  )
  const [typeFilter, setTypeFilter] = React.useState<"all" | MaintenanceType>("all")
  const [openedOn, setOpenedOn] = React.useState("")
  const [logOpen, setLogOpen] = React.useState(false)
  const [closing, setClosing] = React.useState<MaintenanceLog | null>(null)
  const { selected, toggle, toggleAll, clear } = useSelection()

  const assetId = searchParams.get("asset")
  const focused = equipment.find((item) => item.id === assetId) ?? null

  const rows = maintenance.filter((log) => {
    if (assetId && log.equipmentId !== assetId) return false
    if (status !== "all" && log.status !== status) return false
    if (typeFilter !== "all" && log.type !== typeFilter) return false
    if (openedOn && log.openedOn !== openedOn) return false
    return true
  })

  // Only rows still on screen count, so a filter cannot leave a hidden row queued.
  const picked = selected.filter((id) => rows.some((log) => log.id === id))
  const describe = (id: string) => {
    const log = rows.find((entry) => entry.id === id)
    if (!log) return id
    const asset = equipment.find((entry) => entry.id === log.equipmentId)
    return `${asset?.assetTag ?? "—"} ${asset?.name ?? ""} · ${log.type} · ${log.quantity}`
  }
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
        <div className="flex flex-wrap items-center gap-2">
          <DeleteSelectedButton
            count={picked.length}
            labels={picked.map(describe)}
            title="Delete"
            warning="This cannot be undone. Deleting a repair that is still in progress puts its units back as available straight away."
            disabled={!canWrite}
            onConfirm={() => deleteRecords("maintenance", picked)}
            onClear={() => {
              clear()
              setClosing(null)
            }}
          />
          <EmeraldButton disabled={!canWrite} onClick={() => setLogOpen(true)}>
            <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Log maintenance
          </EmeraldButton>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 w-8 bg-slate-50 px-3 pr-0 text-[10px] font-normal text-slate-400">
                <RowCheckbox
                  checked={rows.length > 0 && picked.length === rows.length}
                  onChange={() => toggleAll(rows.map((log) => log.id))}
                  label="Select every maintenance log in this list"
                  disabled={!canWrite || rows.length === 0}
                />
              </TableHead>
              {["Tag", "Asset", "Number", "Type", "Status", "Opened", "Closed", "Technician", "Notes", ""].map((label) => (
                <TableHead key={label || "action"} className="h-9 bg-slate-50 px-3 text-[10px] font-normal text-slate-400">
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11}>
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
                    <TableCell className="w-8 px-3 py-2.5">
                      <RowCheckbox
                        checked={selected.includes(log.id)}
                        onChange={() => toggle(log.id)}
                        label={`Select the ${log.type.toLowerCase()} of ${log.quantity} ${asset?.name ?? "equipment"} opened ${log.openedOn}`}
                        disabled={!canWrite}
                      />
                    </TableCell>
                    {/* The tag names the product, so no internal log id is shown. */}
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-900">{asset?.assetTag ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-[12px] font-normal text-slate-900">{asset?.name}</span>
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
