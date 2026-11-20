"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeftRight, Plus } from "lucide-react"
import {
  DateField,
  EmeraldButton,
  FilterSelect,
  PageIntro,
  SearchField,
} from "@/components/controls"
import { EmptyState } from "@/components/empty-state"
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
import type { Transaction } from "@/lib/types"

const headClass = "h-8 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400"
const cellClass = "px-3 py-2 text-[11px] font-normal text-slate-700"
const monoClass = "px-3 py-2 font-mono text-[11px] font-normal tabular-nums text-slate-700"

export function TransactionsPage() {
  const searchParams = useSearchParams()
  const { transactions, equipment, session } = useStore()
  const canWrite = session?.role !== "VIEWER"
  const assetId = searchParams.get("asset") ?? ""
  const [query, setQuery] = React.useState("")
  const [direction, setDirection] = React.useState("all")
  const [onDate, setOnDate] = React.useState("")
  const [issueOpen, setIssueOpen] = React.useState(false)
  const [returnOpen, setReturnOpen] = React.useState(false)
  const [returning, setReturning] = React.useState<Transaction | null>(null)

  React.useEffect(() => {
    const q = searchParams.get("q")
    if (q !== null) setQuery(q)
  }, [searchParams])

  const focused = equipment.find((item) => item.id === assetId)
  const scoped = assetId ? transactions.filter((item) => item.equipmentId === assetId) : transactions
  const totalOut = scoped.reduce((sum, item) => sum + item.quantity, 0)
  const totalIn = scoped.filter((item) => item.returnedOn).reduce((sum, item) => sum + item.quantity, 0)
  const currentlyOutside = scoped.filter((item) => !item.returnedOn).reduce((sum, item) => sum + item.quantity, 0)

  const rows = scoped.filter((item) => {
    const asset = equipment.find((entry) => entry.id === item.equipmentId)
    const haystack = [asset?.name, asset?.serialNumber, item.issuedTo, item.returnedBy, item.notes]
      .join(" ")
      .toLowerCase()
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
    if (direction === "out" && item.returnedOn) return false
    if (direction === "in" && !item.returnedOn) return false
    if (onDate && item.issuedOn !== onDate && item.returnedOn !== onDate) return false
    return true
  })

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
              {["Direction", "Equipment", "Issued to", "Date out", "Due / returned", "Condition", "Notes", ""].map((label) => (
                <TableHead key={label || "action"} className={headClass}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={ArrowLeftRight}
                    title={transactions.length === 0 ? "No movement yet" : "Nothing matches these filters"}
                    description={transactions.length === 0 ? "Check equipment out when it leaves, and check it in when it comes back." : "Try another name, note, or date."}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((item) => {
                const asset = equipment.find((entry) => entry.id === item.equipmentId)
                const back = Boolean(item.returnedOn)
                return (
                  <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                    <TableCell className={cellClass}>
                      <DirectionBadge direction={back ? "IN" : "OUT"} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <span className="text-slate-900">{asset?.name}</span>
                    </TableCell>
                    <TableCell className={cellClass}>{item.issuedTo}</TableCell>
                    <TableCell className={monoClass}>{item.issuedOn}</TableCell>
                    <TableCell className={monoClass}>{back ? item.returnedOn : item.expectedReturn}</TableCell>
                    <TableCell className={cellClass}>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <ConditionBadge condition={item.conditionOut} />
                        <span className="text-slate-400">→</span>
                        {item.conditionIn ? <ConditionBadge condition={item.conditionIn} /> : <span className="text-[11px] font-normal text-slate-400">Pending</span>}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[180px] px-3 py-2 text-[11px] font-normal text-slate-600">
                      <span className="block truncate" title={item.notes || undefined}>{item.notes || "—"}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      {back ? null : (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="h-7 rounded-md px-2 text-[11px] font-normal text-slate-600"
                          disabled={!canWrite}
                          onClick={() => {
                            setReturning(item)
                            setReturnOpen(true)
                          }}
                        >
                          Check In
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
