"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Package, Plus, Printer, QrCode, Upload, Wrench } from "lucide-react"
import {
  DateField,
  EmeraldButton,
  PillButton,
  FilterSelect,
  PageIntro,
  Panel,
} from "@/components/controls"
import { EmptyState } from "@/components/empty-state"
import {
  AddEquipmentDialog,
  EditEquipmentDialog,
  PrintTagDialog,
} from "@/components/dialogs/equipment-dialogs"
import { ConditionBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { downloadCsv, equipmentRowsFromCsv } from "@/lib/csv"
import { equipmentReceiptHtml, printThermalReceipt } from "@/lib/receipt"
import { countsFor } from "@/lib/stock"
import { useEquipmentSearch } from "@/components/layout/header"
import { useStore } from "@/lib/store"
import type { Equipment } from "@/lib/types"

export function EquipmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { equipment, categories, locations, transactions, maintenance, session, importEquipment } = useStore()
  const { query: headerQuery } = useEquipmentSearch()
  const canWrite = session?.role !== "VIEWER"
  const [query, setQuery] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("all")
  const [nameFilter, setNameFilter] = React.useState("all")
  const [status, setStatus] = React.useState("all")
  const [acquiredBy, setAcquiredBy] = React.useState("")
  const [addOpen, setAddOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Equipment | null>(null)
  const [tagging, setTagging] = React.useState<Equipment | null>(null)
  const [uploadNote, setUploadNote] = React.useState("")
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const next = searchParams.get("status")
    setStatus(next === "available" || next === "checked_out" || next === "maintenance" ? next : "all")
    const q = searchParams.get("q")
    if (q !== null) setQuery(q)
    if (searchParams.get("add") === "1") setAddOpen(true)
  }, [searchParams])

  const rows = equipment.filter((item) => {
    const category = categories.find((entry) => entry.id === item.categoryId)
    const location = locations.find((entry) => entry.id === item.locationId)
    const counts = countsFor(item, transactions, maintenance)
    const haystack = [
      item.name,
      item.assetTag,
      item.serialNumber,
      item.manufacturer,
      item.model,
      item.notes,
      category?.name ?? "",
      location?.name ?? "",
    ]
      .join(" ")
      .toLowerCase()
    const activeQuery = headerQuery.trim() || query.trim()
    if (activeQuery && !haystack.includes(activeQuery.toLowerCase())) return false
    if (categoryId !== "all" && item.categoryId !== categoryId) return false
    if (nameFilter !== "all" && item.name.trim().toLowerCase() !== nameFilter) return false
    if (status === "available" && counts.available < 1) return false
    if (status === "checked_out" && counts.issued < 1) return false
    if (status === "maintenance" && counts.maintenance < 1) return false
    if (acquiredBy && item.acquiredOn > acquiredBy) return false
    return true
  }).sort((left, right) => left.name.localeCompare(right.name) || left.assetTag.localeCompare(right.assetTag))

  const equipmentNames = [...new Map(
    equipment
      .filter((item) => categoryId === "all" || item.categoryId === categoryId)
      .map((item) => [item.name.trim().toLowerCase(), item.name.trim()] as const),
  ).entries()]
    .filter(([value]) => value)
    .sort((left, right) => left[1].localeCompare(right[1]))

  const units = rows.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div>
      <PageIntro
        title="Equipment"
        description="Name, category, and how many of each the company has."
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={categories.some((item) => item.id === categoryId) ? categoryId : "all"}
            onChange={(value) => {
              setCategoryId(value)
              setNameFilter("all")
            }}
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <FilterSelect
            value={equipmentNames.some(([value]) => value === nameFilter) ? nameFilter : "all"}
            onChange={setNameFilter}
            options={[
              { value: "all", label: "All equipment" },
              ...equipmentNames.map(([value, label]) => ({ value, label })),
            ]}
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All statuses" },
              { value: "available", label: "Available" },
              { value: "checked_out", label: "Checked out" },
              { value: "maintenance", label: "Maintenance" },
            ]}
          />
          <DateField value={acquiredBy} onChange={setAcquiredBy} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EmeraldButton
            disabled={!canWrite}
            onClick={() =>
              downloadCsv(
                "equipment-template.csv",
                ["Name", "Number", "Category", "Location", "Manufacturer", "Model", "Condition", "Acquired", "Serial number", "Notes"],
                [],
              )
            }
          >
            CSV template
          </EmeraldButton>
          <EmeraldButton disabled={!canWrite} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            Upload CSV
          </EmeraldButton>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              void file.text().then(async (text) => {
                const result = await importEquipment(equipmentRowsFromCsv(text))
                const skipped = result.skipped.filter((item) => item.line > 0)
                const problem = result.skipped.find((item) => item.line === 0)?.message
                if (problem && result.added === 0) {
                  setUploadNote(problem)
                  return
                }
                const skipText = skipped.length
                  ? ` ${skipped.length} row${skipped.length === 1 ? "" : "s"} skipped${skipped[0] ? `: line ${skipped[0].line}, ${skipped[0].message}` : ""}.`
                  : ""
                setUploadNote(`Added ${result.added}. The register now has ${result.total}.${skipText}`)
                setQuery("")
                setCategoryId("all")
                setNameFilter("all")
                setStatus("all")
                setAcquiredBy("")
              })
            }}
          />
          <EmeraldButton disabled={!canWrite} onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Add equipment
          </EmeraldButton>
        </div>
      </div>
      {uploadNote ? <p className="mb-3 text-[11px] text-slate-600">{uploadNote}</p> : null}

      <Panel title="Registry" count={units}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Equipment", "Category", "Number", "Available", "Issued", "Returned", "Maintenance", "Condition", "Location", "Notes", "Actions"].map((label) => (
                <TableHead
                  key={label}
                  className="h-9 bg-slate-50 px-3 text-[10px] font-normal text-slate-400"
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11}>
                  {equipment.length === 0 ? (
                    <EmptyState
                      icon={Package}
                      title="No equipment registered yet"
                      description="Add the name, the category, and how many the company has."
                      action={
                        <PillButton disabled={!canWrite} onClick={() => setAddOpen(true)}>
                          Add equipment
                        </PillButton>
                      }
                    />
                  ) : (
                    <p className="px-3 py-8 text-center text-[12px] text-slate-500">
                      No equipment matches these filters.
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((item) => {
                const category = categories.find((entry) => entry.id === item.categoryId)
                const location = locations.find((entry) => entry.id === item.locationId)
                const counts = countsFor(item, transactions, maintenance)
                return (
                  <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                    <TableCell className="px-3 py-2.5">
                      <span className="block text-[11px] font-normal text-slate-900">{item.name}</span>
                      <p className="text-[11px] text-slate-500">{item.manufacturer} {item.model}</p>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-[12px] text-slate-700">{category?.name}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-900">{counts.total}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-700">{counts.available}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-700">{counts.issued}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-700">{counts.returned}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      {counts.maintenance > 0 ? (
                        <Link
                          href={`/maintenance?asset=${item.id}`}
                          className="inline-flex h-5 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 text-[10px] font-normal whitespace-nowrap text-rose-700"
                        >
                          <Wrench className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                          {counts.maintenance} in maintenance
                        </Link>
                      ) : (
                        <span className="text-[11px] font-normal text-slate-400">On the hook</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5"><ConditionBadge condition={item.condition} /></TableCell>
                    <TableCell className="px-3 py-2.5 text-[12px] text-slate-700">{location?.code}</TableCell>
                    <TableCell className="max-w-[160px] px-3 py-2.5 text-[11px] font-normal text-slate-600">
                      <span className="block truncate" title={item.notes || undefined}>{item.notes || "—"}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="rounded-md"
                          onClick={() =>
                            printThermalReceipt(
                              equipmentReceiptHtml({
                                name: item.name,
                                category: category?.name ?? "",
                                location: location?.name ?? "",
                                condition: item.condition,
                                total: counts.total,
                                available: counts.available,
                                issued: counts.issued,
                                returned: counts.returned,
                                maintenance: counts.maintenance,
                                notes: item.notes,
                              }),
                            )
                          }
                        >
                          <Printer className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                          Print
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="rounded-md"
                          onClick={() => setTagging(item)}
                        >
                          <QrCode className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                          Tag
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="rounded-md"
                          disabled={!canWrite}
                          onClick={() => setEditing(item)}
                        >
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Panel>

      <AddEquipmentDialog
        open={addOpen}
        onSaved={() => {
          setQuery("")
          setStatus("all")
          setCategoryId("all")
          setNameFilter("all")
          setAcquiredBy("")
          if (searchParams.toString()) router.replace("/equipment")
        }}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open && searchParams.get("add") === "1") router.replace("/equipment")
        }}
      />
      <EditEquipmentDialog
        equipment={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
      <PrintTagDialog
        equipment={tagging}
        open={tagging !== null}
        onOpenChange={(open) => {
          if (!open) setTagging(null)
        }}
      />
    </div>
  )
}
