"use client"

import * as React from "react"
import { PackageCheck } from "lucide-react"
import {
  EmeraldButton,
  fieldInputClass,
  FilterSelect,
  FormError,
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
import { ConditionBadge } from "@/components/status-badge"
import { storeToday, type Condition, type Transaction } from "@/lib/types"
import { useStore } from "@/lib/store"
import { useResetWhen } from "@/hooks/use-reset-when"

const conditionsIn: Condition[] = ["New", "Good", "Fair", "Damaged"]

export function ReturnItemDialog({
  transaction,
  open,
  onOpenChange,
  onReturned,
}: {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReturned?: () => void
}) {
  const { equipment, transactions, returnEquipment } = useStore()
  const openCheckouts = transactions.filter((item) => !item.returnedOn)
  const [selectedId, setSelectedId] = React.useState("")
  const [returnedOn, setReturnedOn] = React.useState(storeToday())
  const [returnedBy, setReturnedBy] = React.useState("")
  const [condition, setCondition] = React.useState<Condition>("Good")
  const [notes, setNotes] = React.useState("")
  const [returnQty, setReturnQty] = React.useState("1")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  useResetWhen(`${open}:${transaction?.id ?? ""}`, () => {
    const initial = transaction && !transaction.returnedOn ? transaction : openCheckouts[0]
    setSelectedId(initial?.id ?? "")
    setReturnedOn(storeToday())
    setReturnedBy(initial?.issuedTo ?? "")
    setReturnQty(String(initial?.quantity ?? 1))
    setCondition("Good")
    setNotes("")
    setError(initial ? "" : "Nothing is currently outside.")
    setSaving(false)
  })

  const selected = openCheckouts.find((item) => item.id === selectedId) ?? null
  const asset = equipment.find((item) => item.id === selected?.equipmentId)
  const comingBack = Number(returnQty)
  const stayingOut = selected && Number.isInteger(comingBack) ? Math.max(0, selected.quantity - comingBack) : selected?.quantity ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!selected || saving) return
            // Equipment comes back on or before today; a later day would put a
            // return on the books before it happened.
            if (returnedOn > storeToday()) {
              setError("The return date cannot be later than today.")
              return
            }
            setSaving(true)
            try {
              const result = await returnEquipment({
                transactionId: selected.id,
                conditionIn: condition,
                notes,
                returnedOn,
                returnedBy,
                quantity: comingBack,
              })
              if (!result.ok) {
                setError(result.message)
                return
              }
              onReturned?.()
              onOpenChange(false)
            } finally {
              setSaving(false)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Return equipment (IN)</DialogTitle>
            <DialogDescription>
              Check the item back in. A damaged return goes to maintenance.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Select item outside</Label>
            {openCheckouts.length ? (
              <FilterSelect
                value={selectedId}
                onChange={(value) => {
                  setSelectedId(value)
                  const next = openCheckouts.find((item) => item.id === value)
                  setReturnedBy(next?.issuedTo ?? "")
                  setReturnQty(String(next?.quantity ?? 1))
                }}
                options={openCheckouts.map((item) => {
                  const piece = equipment.find((entry) => entry.id === item.equipmentId)
                  return {
                    value: item.id,
                    label: `${piece?.assetTag ?? item.id} - ${piece?.name ?? "Equipment"} (Held by: ${item.issuedTo})`,
                  }
                })}
                className="w-full"
              />
            ) : (
              <p className="text-[12px] text-slate-500">Nothing is currently outside.</p>
            )}
          </div>
          {selected ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-qty">Number coming back</Label>
              <Input
                id="return-qty"
                type="number"
                min={1}
                max={selected.quantity}
                step={1}
                value={returnQty}
                onChange={(event) => setReturnQty(event.target.value)}
                className={`${fieldInputClass} font-mono tabular-nums`}
              />
              <p className="text-[10px] font-normal text-slate-500">
                {selected.quantity} are out. {stayingOut} stay out.
              </p>
            </div>
          ) : null}
          {selected ? (
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
              <span className="text-[11px] font-normal text-slate-500">Condition out</span>
              <ConditionBadge condition={selected.conditionOut} />
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-date">Return date</Label>
              <Input
                id="return-date"
                type="date"
                max={storeToday()}
                value={returnedOn}
                onChange={(event) => setReturnedOn(event.target.value)}
                className={`${fieldInputClass} font-mono tabular-nums`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-by">Returned by</Label>
              <Input
                id="return-by"
                value={returnedBy}
                onChange={(event) => setReturnedBy(event.target.value)}
                className={fieldInputClass}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Condition upon return</Label>
            <FilterSelect
              value={condition}
              onChange={(value) => setCondition(value as Condition)}
              options={conditionsIn.map((entry) => ({ value: entry, label: entry }))}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="return-notes">Return notes</Label>
            <Textarea
              id="return-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Inspection remarks"
              className="min-h-16 rounded-md border-slate-200 text-[12px] shadow-2xs"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            {asset ? `${asset.assetTag} comes back as ${condition === "Damaged" ? "maintenance" : "available"}.` : "Choose an item that is still outside."}
          </p>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-md" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <EmeraldButton type="submit" disabled={!selected || saving} aria-busy={saving}>
              {saving ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <PackageCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              )}
              {saving ? "Saving..." : "Return equipment"}
            </EmeraldButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
