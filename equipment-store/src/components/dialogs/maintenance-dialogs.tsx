"use client"

import * as React from "react"
import { Check, Plus } from "lucide-react"
import {
  EmeraldButton,
  fieldInputClass,
  FilterSelect,
  FormError,
  SlateButton,
  Spinner,
} from "@/components/controls"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  storeToday,
  type MaintenanceLog,
  type MaintenanceStatus,
  type MaintenanceType,
} from "@/lib/types"
import { sentenceCase } from "@/lib/format"
import { cancelNavProgress, runLoadingLine } from "@/lib/nav-progress"
import { countsFor } from "@/lib/stock"
import { useStore } from "@/lib/store"
import { useResetWhen } from "@/hooks/use-reset-when"

const types: MaintenanceType[] = ["Inspection", "Calibration", "Repair", "Service", "Gas refill"]
const statuses: { value: MaintenanceStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
]

export function LogMaintenanceDialog({
  open,
  onOpenChange,
  equipmentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId?: string | null
}) {
  const { equipment, transactions, logMaintenance } = useStore()
  const [selectedId, setSelectedId] = React.useState(equipmentId || equipment[0]?.id || "")
  const [type, setType] = React.useState<MaintenanceType>("Inspection")
  const [status, setStatus] = React.useState<MaintenanceStatus>("scheduled")
  const [quantity, setQuantity] = React.useState("1")
  const [technician, setTechnician] = React.useState("")
  const [openedOn, setOpenedOn] = React.useState(storeToday())
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  // Fresh form each time the dialog opens, or when it is opened for another asset.
  useResetWhen(`${open}:${equipmentId ?? ""}`, () => {
    setSelectedId(equipmentId || equipment[0]?.id || "")
    setType("Inspection")
    setStatus("scheduled")
    setQuantity("1")
    setTechnician("")
    setOpenedOn(storeToday())
    setNotes("")
    setError("")
    setSaving(false)
  })

  const selected = equipment.find((item) => item.id === selectedId)
  const available = selected ? countsFor(selected, transactions).available : 0
  const going = Number(quantity)
  const staying = Number.isInteger(going) ? Math.max(0, available - going) : available

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            // Two clicks must not file two logs, so the button locks until the answer lands.
            if (saving) return
            // A log records work that has already started, so its day cannot sit
            // in the future; the date field carries the same ceiling.
            if (openedOn > storeToday()) {
              setError("The opened date cannot be later than today.")
              return
            }
            setSaving(true)
            // The top line is this log's own progress: the dialog only steps
            // aside once the bar is empty again.
            const line = runLoadingLine()
            try {
              const result = await logMaintenance({
                equipmentId: selectedId,
                type,
                status,
                technician,
                openedOn,
                notes,
                quantity: going,
              })
              if (!result.ok) {
                // A refusal is not a receipt: drop the line and say why instead.
                cancelNavProgress()
                setError(result.message)
                return
              }
              await line
              onOpenChange(false)
            } finally {
              setSaving(false)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Log maintenance</DialogTitle>
            <DialogDescription>
              Set how many this log covers. Any job that is not completed holds those units off the hook.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Asset</Label>
              {equipment.length === 0 ? (
                <p className="text-[12px] text-slate-500">Register an asset before logging work against it.</p>
              ) : (
                <FilterSelect
                  value={selectedId}
                  onChange={setSelectedId}
                  options={equipment.map((item) => ({
                    value: item.id,
                    label: `${item.assetTag} · ${item.name}`,
                  }))}
                  className="w-full"
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="mx-qty">Number for maintenance</Label>
              <Input
                id="mx-qty"
                type="number"
                min={1}
                step={1}
                max={status === "completed" ? undefined : Math.max(available, 1)}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className={`${fieldInputClass} font-mono tabular-nums`}
              />
              <p className="text-[10px] font-normal text-slate-500">
                {status === "completed"
                  ? "This number is recorded as work that is already finished, so the units never leave the hook."
                  : `${available} available. ${staying} stay available.`}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <FilterSelect
                value={type}
                onChange={(value) => setType(value as MaintenanceType)}
                options={types.map((item) => ({ value: item, label: item }))}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <FilterSelect value={status} onChange={(value) => setStatus(value as MaintenanceStatus)} options={statuses} className="w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mx-tech">Technician</Label>
              <Input id="mx-tech" value={technician} onChange={(event) => setTechnician(sentenceCase(event.target.value))} className={fieldInputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mx-opened">Opened</Label>
              <Input id="mx-opened" type="date" max={storeToday()} value={openedOn} onChange={(event) => setOpenedOn(event.target.value)} className={`${fieldInputClass} font-mono tabular-nums`} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="mx-notes">Work notes</Label>
              <Textarea id="mx-notes" value={notes} onChange={(event) => setNotes(sentenceCase(event.target.value))} className="rounded-md border-slate-200 text-[12px] shadow-2xs" />
            </div>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-md" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <EmeraldButton type="submit" disabled={!selectedId || saving} aria-busy={saving}>
              <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {saving ? "Logging..." : "Save log"}
            </EmeraldButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CompleteMaintenanceDialog({
  log,
  open,
  onOpenChange,
}: {
  log: MaintenanceLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { equipment, completeMaintenance } = useStore()
  const item = equipment.find((entry) => entry.id === log?.equipmentId)
  const [completedOn, setCompletedOn] = React.useState(storeToday())
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  useResetWhen(`${open}:${log?.id ?? ""}`, () => {
    setCompletedOn(storeToday())
    setNotes("")
    setError("")
    setSaving(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!log || saving) return
            // Work cannot be closed on a day the store has not reached yet.
            if (completedOn > storeToday()) {
              setError("The completed date cannot be later than today.")
              return
            }
            setSaving(true)
            try {
              const result = await completeMaintenance(log.id, { completedOn, notes })
              if (!result.ok) {
                setError(result.message)
                return
              }
              onOpenChange(false)
            } finally {
              setSaving(false)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Mark completed</DialogTitle>
            <DialogDescription>
              Close this work on {item?.assetTag}. If no other repair is open, the asset returns to the hook.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mx-closed">Completed</Label>
            <Input id="mx-closed" type="date" max={storeToday()} value={completedOn} onChange={(event) => setCompletedOn(event.target.value)} className={`${fieldInputClass} font-mono tabular-nums`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mx-close-notes">Closing note</Label>
            <Textarea id="mx-close-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="rounded-md border-slate-200 text-[12px] shadow-2xs" />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-md" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SlateButton type="submit" disabled={!log || saving} aria-busy={saving}>
              {saving ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              )}
              {saving ? "Saving..." : "Mark completed"}
            </SlateButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
