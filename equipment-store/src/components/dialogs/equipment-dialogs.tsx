"use client"

import * as React from "react"
import { Printer, Plus, Tag } from "lucide-react"
import { QrMark } from "@/components/qr-mark"
import {
  EmeraldButton,
  fieldInputClass,
  FilterSelect,
  FormError,
  SlateButton,
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
import { sentenceCase } from "@/lib/format"
import { cancelNavProgress, runLoadingLine } from "@/lib/nav-progress"
import { countsFor } from "@/lib/stock"
import { ConditionBadge } from "@/components/status-badge"
import { storeToday, type Condition, type Equipment } from "@/lib/types"
import { useStore } from "@/lib/store"

const conditions: Condition[] = ["New", "Good", "Fair", "Poor"]

function useReset(open: boolean, reset: () => void) {
  React.useEffect(() => {
    if (open) reset()
    // reset identity changes every render; only react to open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

export function AddEquipmentDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const { categories, locations, addEquipment } = useStore()
  const [name, setName] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "")
  const [locationName, setLocationName] = React.useState("")
  const [serialNumber, setSerialNumber] = React.useState("")
  const [quantity, setQuantity] = React.useState("1")
  const [condition, setCondition] = React.useState<Condition>("Good")
  const [acquiredOn, setAcquiredOn] = React.useState(storeToday())
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState("")

  useReset(open, () => {
    setName("")
    setCategoryId("")
    setLocationId(locations[0]?.id ?? "")
    setLocationName("")
    setSerialNumber("")
    setQuantity("1")
    setCondition("Good")
    setAcquiredOn(storeToday())
    setNotes("")
    setError("")
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            const picked = categories.find((item) => item.id === categoryId)
            if (!picked) {
              setError("Select a category from the list.")
              return
            }
            // The register only holds what has already been filed away, so a day
            // the store has not reached yet is refused here as well as in the
            // date field's own ceiling.
            if (acquiredOn > storeToday()) {
              setError("The acquired date cannot be later than today.")
              return
            }
            const pickedLocation = locations.find((item) => item.id === locationId) ?? locations[0]
            const parsedQuantity = Number(quantity)
            const result = await addEquipment({
              name,
              categoryId: picked.id,
              locationId: pickedLocation?.id ?? "",
              categoryName: picked.name,
              locationName: pickedLocation?.name ?? locationName,
              serialNumber,
              quantity: parsedQuantity,
              manufacturer: "",
              model: "",
              condition,
              acquiredOn,
              notes,
            })
            if (!result.ok) {
              setError(result.message)
              return
            }
            onSaved?.()
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>Add equipment</DialogTitle>
            <DialogDescription>
              File the name, the category, and how many the company has. One record can be 5, 10, or 50.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="add-name">Name</Label>
              <Input id="add-name" value={name} onChange={(event) => setName(sentenceCase(event.target.value))} className={fieldInputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <FilterSelect
                value={categoryId}
                onChange={setCategoryId}
                options={[
                  { value: "", label: "Select a category" },
                  ...categories.map((item) => ({ value: item.id, label: item.name })),
                ]}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-quantity">Number</Label>
              <Input
                id="add-quantity"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="10"
                className={`${fieldInputClass} font-mono tabular-nums`}
              />
            </div>
            {locations.length === 0 ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-location">Home location</Label>
                <Input id="add-location" value={locationName} onChange={(event) => setLocationName(sentenceCase(event.target.value))} placeholder="Main cage" className={fieldInputClass} />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Home location</Label>
                <FilterSelect
                  value={locationId || locations[0].id}
                  onChange={setLocationId}
                  options={locations.map((item) => ({ value: item.id, label: item.name }))}
                  className="w-full"
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-serial">Serial number</Label>
              <Input id="add-serial" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Optional" className={`${fieldInputClass} font-mono tabular-nums`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Condition</Label>
              <FilterSelect
                value={condition}
                onChange={(value) => setCondition(value as Condition)}
                options={conditions.map((item) => ({ value: item, label: item }))}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-acquired">Acquired</Label>
              <Input id="add-acquired" type="date" max={storeToday()} value={acquiredOn} onChange={(event) => setAcquiredOn(event.target.value)} className={`${fieldInputClass} font-mono tabular-nums`} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="add-notes">Cage notes</Label>
              <Textarea id="add-notes" value={notes} onChange={(event) => setNotes(sentenceCase(event.target.value))} className="rounded-md border-slate-200 text-[12px] shadow-2xs" />
            </div>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-md" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <EmeraldButton type="submit">
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Save asset
            </EmeraldButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditEquipmentDialog({
  equipment,
  open,
  onOpenChange,
}: {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { categories, locations, updateEquipment } = useStore()
  const [name, setName] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [locationId, setLocationId] = React.useState("")
  const [serialNumber, setSerialNumber] = React.useState("")
  const [quantity, setQuantity] = React.useState("1")
  const [manufacturer, setManufacturer] = React.useState("")
  const [model, setModel] = React.useState("")
  const [condition, setCondition] = React.useState<Condition>("Good")
  const [acquiredOn, setAcquiredOn] = React.useState(storeToday())
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState("")

  useReset(open, () => {
    if (!equipment) return
    setName(equipment.name)
    setQuantity(String(equipment.quantity))
    setCategoryId(equipment.categoryId)
    setLocationId(equipment.locationId)
    setSerialNumber(equipment.serialNumber)
    setManufacturer(equipment.manufacturer)
    setModel(equipment.model)
    setCondition(equipment.condition)
    setAcquiredOn(equipment.acquiredOn)
    setNotes(equipment.notes)
    setError("")
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!equipment) return
            if (acquiredOn > storeToday()) {
              setError("The acquired date cannot be later than today.")
              return
            }
            const result = await updateEquipment(equipment.id, {
              name,
              categoryId,
              locationId,
              serialNumber,
              quantity: Number(quantity),
              manufacturer,
              model,
              condition,
              acquiredOn,
              notes,
            })
            if (!result.ok) {
              setError(result.message)
              return
            }
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit equipment</DialogTitle>
            <DialogDescription>
              <span className="font-mono tabular-nums">{equipment?.assetTag}</span> stays on this record. Status changes when the item is issued, returned, or pulled for repair.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={name} onChange={(event) => setName(sentenceCase(event.target.value))} className={fieldInputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <FilterSelect
                value={categoryId}
                onChange={setCategoryId}
                options={categories.map((item) => ({ value: item.id, label: item.name }))}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-quantity">Number</Label>
              <Input id="edit-quantity" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} className={`${fieldInputClass} font-mono tabular-nums`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Home location</Label>
              <FilterSelect value={locationId} onChange={setLocationId} options={locations.map((item) => ({ value: item.id, label: item.name }))} className="w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-serial">Serial number</Label>
              <Input id="edit-serial" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} className={`${fieldInputClass} font-mono tabular-nums`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Condition</Label>
              <FilterSelect
                value={condition}
                onChange={(value) => setCondition(value as Condition)}
                options={(conditions.includes(condition) ? conditions : [condition, ...conditions]).map((item) => ({ value: item, label: item }))}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-maker">Manufacturer</Label>
              <Input id="edit-maker" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} className={fieldInputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-model">Model</Label>
              <Input id="edit-model" value={model} onChange={(event) => setModel(event.target.value)} className={fieldInputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-acquired">Acquired</Label>
              <Input id="edit-acquired" type="date" max={storeToday()} value={acquiredOn} onChange={(event) => setAcquiredOn(event.target.value)} className={`${fieldInputClass} font-mono tabular-nums`} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="edit-notes">Cage notes</Label>
              <Textarea id="edit-notes" value={notes} onChange={(event) => setNotes(sentenceCase(event.target.value))} className="rounded-md border-slate-200 text-[12px] shadow-2xs" />
            </div>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-md" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SlateButton type="submit">Save changes</SlateButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A week out from today, read fresh every time the dialog opens. A due date
 * may sit in the future, but it may never sit behind the store's own day, so
 * the default has to move with the calendar instead of being a fixed string.
 */
function dueInAWeek() {
  const [year, month, day] = storeToday().split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10)
}

export function IssueEquipmentDialog({
  open,
  onOpenChange,
  equipmentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId?: string | null
}) {
  const { equipment, transactions, issueEquipment } = useStore()
  const available = equipment.filter((item) => countsFor(item, transactions).available > 0)
  const [selectedId, setSelectedId] = React.useState("")
  const [issuedTo, setIssuedTo] = React.useState("")
  const [expectedReturn, setExpectedReturn] = React.useState(() => dueInAWeek())
  const [quantity, setQuantity] = React.useState("1")
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  useReset(open, () => {
    const preferred = available.find((item) => item.id === equipmentId) ?? available[0]
    setSelectedId(preferred?.id ?? "")
    setIssuedTo("")
    setExpectedReturn(dueInAWeek())
    setQuantity("1")
    setNotes("")
    setError(preferred ? "" : "Nothing on the hook is available to issue.")
    setSaving(false)
  })

  const selected = available.find((item) => item.id === selectedId)
  const onHand = selected ? countsFor(selected, transactions).available : 0
  const options = available.map((item) => ({
    value: item.id,
    label: `${item.name} · ${countsFor(item, transactions).available} available`,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            // Two clicks must not issue two loads, so the button locks until the
            // line has finished and the answer has landed.
            if (saving) return
            setSaving(true)
            // The top line is this check-out's own progress: the dialog only
            // steps aside once the bar is empty again.
            const line = runLoadingLine()
            try {
              const result = await issueEquipment({
                equipmentId: selectedId,
                issuedTo,
                expectedReturn,
                conditionOut: selected?.condition ?? "Good",
                notes,
                quantity: Number(quantity),
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
            <DialogTitle>Issue equipment</DialogTitle>
            <DialogDescription>
              Records who has the item and the date it is expected back on the hook.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Asset</Label>
              {options.length ? (
                <FilterSelect value={selectedId} onChange={setSelectedId} options={options} className="w-full" />
              ) : (
                <p className="text-[12px] text-slate-500">No available assets.</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-qty">Number to issue</Label>
              <Input
                id="issue-qty"
                type="number"
                min={1}
                max={onHand || 1}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className={`${fieldInputClass} font-mono tabular-nums`}
              />
              <p className="text-[10px] text-slate-500">{onHand} available</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-to">Issued to</Label>
              <Input
                id="issue-to"
                value={issuedTo}
                onChange={(event) => setIssuedTo(event.target.value)}
                placeholder="Person taking the item"
                className={fieldInputClass}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-due">Expected return</Label>
                <Input id="issue-due" type="date" min={storeToday()} value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} className={`${fieldInputClass} font-mono tabular-nums`} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Condition out</Label>
                <div className="flex h-8 items-center">
                  {selected ? <ConditionBadge condition={selected.condition} /> : <span className="text-[12px] text-slate-500">Choose an asset</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-notes">Issue notes</Label>
              <Textarea id="issue-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Job, accessories counted out, anything the next shift should know." className="rounded-md border-slate-200 text-[12px] shadow-2xs" />
            </div>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-md" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <EmeraldButton type="submit" disabled={!selectedId || saving} aria-busy={saving}>
              <Tag className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {saving ? "Issuing..." : "Issue item"}
            </EmeraldButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PrintTagDialog({
  equipment,
  open,
  onOpenChange,
}: {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Print QR tag</DialogTitle>
          <DialogDescription>Stick this on the case. Scanning the square opens the whole record for this item.</DialogDescription>
        </DialogHeader>
        {equipment ? <AssetTagCard equipment={equipment} /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-md" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <SlateButton type="button" onClick={() => window.print()}>
            <Printer className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Print tag
          </SlateButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The label itself. The square carries the address of /equipment/<id> on the
 * running app, read from the window after mount: the server has no origin, and
 * a tag printed with "localhost" would open nothing on the phone that scans it.
 * Whatever address the operator reached the app on — the machine's LAN address
 * on the shop's Wi-Fi — is the address the phone will reach too.
 */
const subscribeToOrigin = () => () => {}
const readOrigin = () => window.location.origin
const readNoOrigin = () => ""

function AssetTagCard({ equipment }: { equipment: Equipment }) {
  // The address cannot change while the dialog is open, so there is nothing to
  // subscribe to; the server simply has no origin to read.
  const origin = React.useSyncExternalStore(subscribeToOrigin, readOrigin, readNoOrigin)
  const recordPath = `/equipment/${equipment.id}`

  return (
    <div id="asset-tag" className="rounded-md border border-slate-900 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-normal tracking-wide text-slate-500 uppercase">Ballons Store</p>
          <p className="mt-1 text-xs font-normal text-slate-900">{equipment.name}</p>
          <p className="text-[11px] text-slate-500">{equipment.manufacturer} {equipment.model}</p>
        </div>
        <QrMark value={`${origin}${recordPath}`} />
      </div>
      <p className="mt-4 font-mono text-lg tabular-nums tracking-tight text-slate-900">{equipment.assetTag}</p>
      <p className="font-mono text-[11px] tabular-nums text-slate-500">{equipment.serialNumber}</p>
      <p className="mt-2 border-t border-dashed border-slate-300 pt-1.5 text-[10px] font-normal text-slate-500">
        Scan the square for every detail recorded for this item.
      </p>
    </div>
  )
}
