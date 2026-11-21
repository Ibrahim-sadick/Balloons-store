"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { Spinner } from "@/components/controls"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Result } from "@/lib/types"

/**
 * Ticked rows for a delete. The pages keep the list and hand it over as-is; a
 * refresh or a filter that hides a row should not silently keep it queued, so
 * every page intersects this list with what is on screen before showing a count.
 */
export function useSelection() {
  const [selected, setSelected] = React.useState<string[]>([])

  const toggle = React.useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }, [])

  const toggleAll = React.useCallback((ids: string[]) => {
    setSelected((current) =>
      ids.every((id) => current.includes(id))
        ? current.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current, ...ids])),
    )
  }, [])

  const clear = React.useCallback(() => setSelected([]), [])

  return { selected, toggle, toggleAll, clear }
}

/** The square itself: a native checkbox keeps keyboard and screen-reader behaviour. */
export function RowCheckbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <input
      type="checkbox"
      className="size-3.5 cursor-pointer rounded-sm accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={onChange}
    />
  )
}

/**
 * The red delete control: one button that only appears once something is
 * ticked, then a dialog that names what is about to go. Deletion is permanent,
 * so nothing is sent until the operator presses the button inside the dialog.
 */
export function DeleteSelectedButton({
  count,
  labels,
  warning,
  title,
  confirmLabel = "Delete",
  onConfirm,
  onClear,
  disabled,
}: {
  count: number
  labels: string[]
  warning: string
  title: string
  confirmLabel?: string
  onConfirm: () => Promise<Result>
  onClear: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  // After a partial failure the list can shrink to zero while the dialog still
  // has to stay up, otherwise the reason for the failure would vanish with it.
  if (count === 0 && !open) return null

  const shown = labels.slice(0, 8)
  const rest = labels.length - shown.length

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="rounded-md"
        disabled={disabled || busy}
        onClick={() => {
          setError("")
          setOpen(true)
        }}
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        Delete {count}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return
          setOpen(next)
          if (!next) setError("")
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {title} {count === 1 ? "1 record" : `${count} records`}?
            </DialogTitle>
            <DialogDescription>{warning}</DialogDescription>
          </DialogHeader>

          <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
            {shown.map((label) => (
              <li key={label} className="truncate py-0.5" title={label}>
                {label}
              </li>
            ))}
            {rest > 0 ? <li className="py-0.5 text-slate-400">and {rest} more</li> : null}
          </ul>

          {error ? (
            <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-md"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-md bg-rose-600 text-white hover:bg-rose-700"
              disabled={busy}
              aria-busy={busy}
              onClick={async () => {
                if (busy) return
                setBusy(true)
                setError("")
                try {
                  const result = await onConfirm()
                  if (!result.ok) {
                    setError(result.message)
                    return
                  }
                  onClear()
                  setOpen(false)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? <Spinner className="h-3.5 w-3.5 shrink-0" /> : <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />}
              {busy ? "Deleting..." : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
