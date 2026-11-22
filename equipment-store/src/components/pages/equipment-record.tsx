"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Printer, QrCode } from "lucide-react"
import { PageIntro, Panel, SlateButton } from "@/components/controls"
import { EmptyState } from "@/components/empty-state"
import { useStoreToday } from "@/hooks/use-store-today"
import { formatWhen, isPastDue } from "@/lib/format"
import { equipmentReceiptHtml, printThermalReceipt } from "@/lib/receipt"
import { countsFor, statusFor } from "@/lib/stock"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const stateLabels = {
  available: "Available",
  checked_out: "Checked out",
  maintenance: "In maintenance",
} as const

/** The dashed tear between blocks, the way a till slip divides its sections. */
function Rule() {
  return <div aria-hidden="true" className="my-2.5 border-t border-dashed border-slate-300" />
}

/** One label-and-figure line; the label stays quiet, the figure carries the ink. */
function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: React.ReactNode
  tone?: "rose" | "emerald"
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[1.5px]">
      <span className="shrink-0 text-[9px] font-normal tracking-[0.1em] text-slate-500 uppercase">{label}</span>
      <span
        className={cn(
          "min-w-0 text-right font-mono text-[10.5px] font-normal break-words tabular-nums text-slate-900",
          tone === "rose" && "text-rose-700",
          tone === "emerald" && "text-emerald-700",
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** A section's name across the slip, with how many entries are under it. */
function Heading({ title, count }: { title: string; count?: number }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-[9px] font-normal tracking-[0.16em] text-slate-500 uppercase">
      <span>{title}</span>
      {count !== undefined ? <span className="font-mono tabular-nums">{count}</span> : null}
    </p>
  )
}

/**
 * The page behind a scanned tag, drawn as the slip the store would print: the
 * same header, dashed rules, mono figures and "end of receipt" foot, so what a
 * phone shows after reading the square on a shelf is the paper record of that
 * item — every field the register holds, the five stock figures, and each
 * movement and repair logged against it.
 */
export function EquipmentRecordPage({ id }: { id: string }) {
  const { equipment, categories, locations, transactions, maintenance, ready } = useStore()
  const today = useStoreToday()
  const asset = equipment.find((item) => item.id === id)

  if (!ready) {
    return (
      <div>
        <PageIntro title="Equipment record" description="Reading the register…" />
      </div>
    )
  }

  if (!asset) {
    return (
      <div>
        <PageIntro title="Equipment record" description="The tag did not match anything on this register." />
        <Panel title="Nothing found" icon={<QrCode className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />}>
          <div className="px-3 py-6">
            <EmptyState
              icon={QrCode}
              title="This tag is not on the register"
              description="The item may have been deleted, or the label belongs to another store. Open Equipment to check the list."
            />
            <div className="mt-3 flex justify-center">
              <Link
                href="/equipment"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-normal text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                All equipment
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  const category = categories.find((entry) => entry.id === asset.categoryId)
  const location = locations.find((entry) => entry.id === asset.locationId)
  const counts = countsFor(asset, transactions, maintenance)
  const state = stateLabels[statusFor(counts)]
  const overdue = counts.issued > 0 && isPastDue(asset.expectedReturn, today)
  const movements = transactions
    .filter((entry) => entry.equipmentId === asset.id)
    .sort((left, right) => right.issuedOn.localeCompare(left.issuedOn) || left.id.localeCompare(right.id))
  const repairs = maintenance
    .filter((log) => log.equipmentId === asset.id)
    .sort((left, right) => right.openedOn.localeCompare(left.openedOn) || left.id.localeCompare(right.id))
  const openJobs = repairs.filter((log) => log.status !== "completed").length

  const printReceipt = () =>
    printThermalReceipt(
      equipmentReceiptHtml({
        name: asset.name,
        assetTag: asset.assetTag,
        serial: asset.serialNumber,
        category: category?.name ?? "",
        location: location?.name ?? "",
        manufacturer: asset.manufacturer,
        model: asset.model,
        condition: asset.condition,
        state,
        acquiredOn: asset.acquiredOn,
        expectedReturn: asset.expectedReturn ?? "",
        total: counts.total,
        available: counts.available,
        issued: counts.issued,
        returned: counts.returned,
        maintenance: counts.maintenance,
        openRepairs: openJobs,
        notes: asset.notes,
      }),
    )

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href="/equipment"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-normal text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          All equipment
        </Link>
        <SlateButton type="button" onClick={printReceipt}>
          <Printer className="mr-1 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Print receipt
        </SlateButton>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white px-5 py-5 font-mono text-slate-900 shadow-2xs">
        <header className="text-center">
          <p className="text-[10px] font-normal tracking-[0.14em] uppercase">Shine Balloon Safaris</p>
          <p className="mt-0.5 text-[9px] font-normal tracking-[0.16em] text-slate-500 uppercase">Equipment receipt</p>
          <p className="mt-1.5 text-[9.5px] font-normal text-slate-500">{today}</p>
        </header>

        <Rule />

        <div className="text-center">
          <p className="text-[13px] leading-tight font-normal tracking-[0.04em] uppercase">{asset.name}</p>
          <p className="mt-1 text-[10px] font-normal tabular-nums text-slate-500">{asset.assetTag}</p>
        </div>

        <Rule />

        <div>
          <Row label="Serial" value={asset.serialNumber || "—"} />
          <Row label="Category" value={category?.name ?? "—"} />
          <Row label="Stored at" value={location?.name ?? "—"} />
          <Row label="Manufacturer" value={asset.manufacturer || "—"} />
          <Row label="Model" value={asset.model || "—"} />
          <Row label="Condition" value={asset.condition} />
          <Row label="State" value={state} tone={statusFor(counts) === "available" ? "emerald" : undefined} />
          <Row label="Acquired" value={asset.acquiredOn} />
          <Row label="Due back" value={asset.expectedReturn ?? "—"} />
        </div>

        <Rule />

        <div>
          <Row label="On the register" value={counts.total} />
          <Row label="Available" value={counts.available} tone={counts.available > 0 ? "emerald" : undefined} />
          <Row label="Still out" value={counts.issued} tone={counts.issued > 0 ? "rose" : undefined} />
          <Row label="Back in" value={counts.returned} />
          <Row label="In repair" value={counts.maintenance} />
          {repairs.length > 0 ? <Row label="Open repairs" value={openJobs} /> : null}
          <Row label="Overdue" value={overdue ? "Yes" : "No"} tone={overdue ? "rose" : undefined} />
        </div>

        <Rule />

        <div>
          <p className="text-[9px] font-normal tracking-[0.16em] text-slate-500 uppercase">Notes</p>
          <p className="mt-1 text-[10.5px] leading-relaxed font-normal break-words whitespace-pre-line text-slate-800">
            {asset.notes || "—"}
          </p>
        </div>

        <Rule />

        <section>
          <Heading title="Movement history" count={movements.length} />
          {movements.length === 0 ? (
            <p className="mt-1.5 text-[10px] font-normal text-slate-500">
              This item has not been checked out yet.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-2.5">
              {movements.map((entry, index) => (
                <li key={entry.id}>
                  {index > 0 ? <div className="mb-2.5 border-t border-dashed border-slate-200" /> : null}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[10.5px] font-normal tabular-nums">{entry.issuedOn}</span>
                    <span className="text-[10.5px] font-normal text-slate-700">{entry.quantity} units out</span>
                  </div>
                  <div className="mt-1">
                    <Row label="Issued to" value={entry.issuedTo} />
                    <Row label="Issued by" value={entry.issuedBy} />
                    <Row label="Expected" value={entry.expectedReturn} />
                    <Row
                      label="Back in"
                      value={entry.returnedOn ? formatWhen(entry.returnedOn) : "Still out"}
                      tone={entry.returnedOn ? undefined : "rose"}
                    />
                    {entry.returnedBy ? <Row label="Received by" value={entry.returnedBy} /> : null}
                    <Row
                      label="Condition"
                      value={
                        entry.conditionIn ? `${entry.conditionOut} → ${entry.conditionIn}` : `${entry.conditionOut} → pending`
                      }
                    />
                    {entry.notes ? <Row label="Note" value={entry.notes} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Rule />

        <section>
          <Heading title="Maintenance" count={repairs.length} />
          {repairs.length === 0 ? (
            <p className="mt-1.5 text-[10px] font-normal text-slate-500">No repair has been logged against this item.</p>
          ) : (
            <ul className="mt-1.5 space-y-2.5">
              {repairs.map((log, index) => (
                <li key={log.id}>
                  {index > 0 ? <div className="mb-2.5 border-t border-dashed border-slate-200" /> : null}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[10.5px] font-normal tabular-nums">{log.openedOn}</span>
                    <span className="text-[10.5px] font-normal text-slate-700">{log.quantity} units</span>
                  </div>
                  <div className="mt-1">
                    <Row label="Type" value={log.type} />
                    <Row
                      label="Status"
                      value={log.status === "completed" ? "Completed" : log.status === "in_progress" ? "In progress" : "Scheduled"}
                      tone={log.status === "completed" ? "emerald" : "rose"}
                    />
                    <Row label="Technician" value={log.technician} />
                    <Row
                      label="Completed"
                      value={log.completedOn ? formatWhen(log.completedOn) : "Open"}
                      tone={log.completedOn ? undefined : "rose"}
                    />
                    {log.notes ? <Row label="Note" value={log.notes} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Rule />

        <footer className="text-center">
          <p className="text-[9px] font-normal tracking-[0.16em] text-slate-500 uppercase">Scanned from the tag</p>
          <p className="mt-0.5 text-[9.5px] font-normal tabular-nums text-slate-500">{today}</p>
          <p className="mt-2 text-[9px] font-normal tracking-[0.18em] text-slate-500 uppercase">End of receipt</p>
        </footer>
      </article>

      <p className="mt-3 text-center text-[10px] font-normal text-slate-400">
        This is the store record, not a sale. {asset.name} holds {counts.total} units on the register.
      </p>
    </div>
  )
}
