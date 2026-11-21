"use client"

import * as React from "react"
import { ApiFailure, apiRequest } from "@/lib/api"
import type { EquipmentCsvRow } from "@/lib/csv"
import type {
  ActivityEvent,
  Category,
  Condition,
  Equipment,
  MaintenanceLog,
  MaintenanceStatus,
  MaintenanceType,
  Result,
  Role,
  StaffUser,
  StoreLocation,
  Transaction,
} from "@/lib/types"

const SESSION_KEY = "balons-session"

type StoreState = {
  equipment: Equipment[]
  transactions: Transaction[]
  maintenance: MaintenanceLog[]
  activity: ActivityEvent[]
  users: StaffUser[]
  categories: Category[]
  locations: StoreLocation[]
}

type NewEquipmentInput = {
  name: string
  categoryId: string
  locationId: string
  categoryName?: string
  locationName?: string
  locationZone?: string
  serialNumber: string
  quantity: number
  manufacturer: string
  model: string
  condition: Condition
  acquiredOn: string
  notes: string
}

type StoreContextValue = StoreState & {
  session: StaffUser | null
  ready: boolean
  signIn: (email: string, password: string) => Promise<Result>
  signOut: () => void
  addEquipment: (input: NewEquipmentInput) => Promise<Result>
  importEquipment: (rows: EquipmentCsvRow[]) => Promise<{
    ok: true
    added: number
    total: number
    skipped: { line: number; message: string }[]
  }>
  updateEquipment: (
    id: string,
    patch: Partial<
      Pick<
        Equipment,
        | "name"
        | "categoryId"
        | "locationId"
        | "serialNumber"
        | "manufacturer"
        | "model"
        | "condition"
        | "acquiredOn"
        | "notes"
        | "quantity"
      >
    >,
  ) => Promise<Result>
  issueEquipment: (input: {
    equipmentId: string
    issuedTo: string
    expectedReturn: string
    conditionOut: Condition
    notes: string
    quantity: number
  }) => Promise<Result>
  returnEquipment: (input: {
    transactionId: string
    conditionIn: Condition
    notes: string
    returnedOn: string
    returnedBy: string
    quantity: number
  }) => Promise<Result>
  logMaintenance: (input: {
    equipmentId: string
    type: MaintenanceType
    status: MaintenanceStatus
    technician: string
    openedOn: string
    notes: string
    quantity: number
  }) => Promise<Result>
  completeMaintenance: (id: string, input: { completedOn: string; notes: string }) => Promise<Result>
  /**
   * Deletes whole records: one id per ticked row. Movements accept the row id
   * the list shows (`<checkoutId>` or `<checkoutId>:<returnId>`).
   */
  deleteRecords: (kind: DeleteKind, ids: string[]) => Promise<Result>
  setUserRole: (id: string, role: Role) => Promise<void>
  addCategory: (name: string) => Promise<Result>
  addLocation: (input: { name: string; zone: string }) => Promise<Result>
}

const StoreContext = React.createContext<StoreContextValue | null>(null)

const EMPTY_STATE: StoreState = {
  equipment: [],
  transactions: [],
  maintenance: [],
  activity: [],
  users: [],
  categories: [],
  locations: [],
}

type SessionPayload = { token: string; user: StaffUser }

/** Which table a delete belongs to; each maps to its own API path. */
export type DeleteKind = "equipment" | "movement" | "maintenance"

const DELETE_PATHS: Record<DeleteKind, string> = {
  equipment: "/api/equipment",
  movement: "/api/checkouts",
  maintenance: "/api/maintenance",
}

/** Which half of the snapshot a write can invalidate. */
type ReloadScope = "all" | "ledger"

type Sent = { ok: true } | { ok: false; message: string }

function messageOf(error: unknown): string {
  if (error instanceof ApiFailure) return error.message
  if (error instanceof Error && error.message) return error.message
  return "The store server did not answer. Try again."
}

/**
 * A scoped refresh answers with the ledger only, so the reference tables keep
 * whatever the last full load returned instead of being wiped to empty.
 */
function patchState(current: StoreState, data: Partial<StoreState>): StoreState {
  return {
    equipment: data.equipment ?? current.equipment,
    transactions: data.transactions ?? current.transactions,
    maintenance: data.maintenance ?? current.maintenance,
    activity: data.activity ?? current.activity,
    users: data.users ?? current.users,
    categories: data.categories ?? current.categories,
    locations: data.locations ?? current.locations,
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<StoreState>(EMPTY_STATE)
  const [session, setSession] = React.useState<StaffUser | null>(null)
  const [token, setToken] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)

  const load = React.useCallback(async (authToken: string, scope: ReloadScope = "all") => {
    const path = scope === "ledger" ? "/api/bootstrap?scope=ledger" : "/api/bootstrap"
    const data = await apiRequest<Partial<StoreState>>(path, { token: authToken })
    setState((current) => patchState(current, data))
  }, [])

  React.useEffect(() => {
    let cancelled = false

    const restore = async () => {
      const raw = window.sessionStorage.getItem(SESSION_KEY)
      if (!raw) return

      let parsed: Partial<SessionPayload>
      try {
        parsed = JSON.parse(raw) as Partial<SessionPayload>
      } catch {
        window.sessionStorage.removeItem(SESSION_KEY)
        return
      }
      if (!parsed.token || !parsed.user) {
        window.sessionStorage.removeItem(SESSION_KEY)
        return
      }

      // Paint the page that was being reloaded straight away, then confirm with
      // the server. Only a token the server rejects ends the session; an API
      // that is merely unreachable must not sign the operator out mid-shift.
      setToken(parsed.token)
      setSession(parsed.user)

      try {
        await load(parsed.token)
      } catch (error) {
        if (!cancelled && error instanceof ApiFailure && (error.status === 401 || error.status === 403)) {
          window.sessionStorage.removeItem(SESSION_KEY)
          setToken(null)
          setSession(null)
        }
      }
    }

    restore().finally(() => {
      if (!cancelled) setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [load])

  const clearSession = React.useCallback(() => {
    window.sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    setToken(null)
    setState(EMPTY_STATE)
  }, [])

  /** Every write refreshes the snapshot so counts and activity stay truthful. */
  const send = React.useCallback(
    async <T,>(path: string, method: "POST" | "PATCH", body: unknown, scope: ReloadScope = "all"): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
      if (!token) return { ok: false, message: "Sign in to continue." }
      try {
        const data = await apiRequest<T>(path, { method, body, token })
        await load(token, scope)
        return { ok: true, data }
      } catch (error) {
        if (error instanceof ApiFailure && error.status === 401) clearSession()
        return { ok: false, message: messageOf(error) }
      }
    },
    [token, load, clearSession],
  )

  const value = React.useMemo<StoreContextValue>(() => {
    const asResult = async (run: Promise<Sent>): Promise<Result> => {
      const result = await run
      return result.ok ? { ok: true } : { ok: false, message: result.message }
    }

    return {
      ...state,
      session,
      ready,
      signIn: async (email, password) => {
        try {
          const data = await apiRequest<SessionPayload>("/api/auth/login", {
            method: "POST",
            body: { email, password },
          })
          window.sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ token: data.token, user: data.user }),
          )
          setSession(data.user)
          setToken(data.token)
          await load(data.token)
          return { ok: true }
        } catch (error) {
          // A 401 is the only answer that means the store does not recognise this
          // email and password pair. It carries a flag so the sign-in card can show
          // the access notice in red rather than the generic server wording.
          return { ok: false, message: messageOf(error), denied: error instanceof ApiFailure && error.status === 401 }
        }
      },
      signOut: () => {
        clearSession()
        void apiRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined)
      },
      addEquipment: (input) =>
        asResult(send("/api/equipment", "POST", { ...input, acquiredOn: input.acquiredOn })),
      importEquipment: async (rows) => {
        if (rows.length === 0) {
          return {
            ok: true,
            added: 0,
            total: state.equipment.reduce((sum, item) => sum + item.quantity, 0),
            skipped: [{ line: 0, message: "That CSV has no equipment rows." }],
          }
        }
        const result = await send<{
          added: number
          total: number
          skipped: { line: number; message: string }[]
        }>("/api/equipment/import", "POST", { rows })
        if (!result.ok) {
          return {
            ok: true,
            added: 0,
            total: state.equipment.reduce((sum, item) => sum + item.quantity, 0),
            skipped: [{ line: 0, message: result.message }],
          }
        }
        return {
          ok: true,
          added: result.data.added,
          total: result.data.total,
          skipped: result.data.skipped,
        }
      },
      updateEquipment: (id, patch) =>
        asResult(send(`/api/equipment/${id}`, "PATCH", patch, "ledger")),
      issueEquipment: (input) =>
        asResult(
          send(
            "/api/checkouts",
            "POST",
            {
              equipmentId: input.equipmentId,
              quantity: input.quantity,
              issuedTo: input.issuedTo,
              expectedReturn: input.expectedReturn,
              conditionOut: input.conditionOut,
              notes: input.notes,
            },
            "ledger",
          ),
        ),
      returnEquipment: (input) =>
        asResult(
          send(
            `/api/checkouts/${input.transactionId}/returns`,
            "POST",
            {
              quantity: input.quantity,
              returnedOn: input.returnedOn,
              returnedBy: input.returnedBy,
              conditionIn: input.conditionIn,
              notes: input.notes,
            },
            "ledger",
          ),
        ),
      logMaintenance: (input) => asResult(send("/api/maintenance", "POST", input, "ledger")),
      completeMaintenance: (id, input) =>
        asResult(send(`/api/maintenance/${id}/complete`, "POST", input, "ledger")),
      deleteRecords: async (kind, ids) => {
        if (!token) return { ok: false, message: "Sign in to continue." }
        // One refusal must not abandon the rest of the selection, so every id is
        // attempted and the first real reason is reported at the end.
        let firstFailure = ""
        for (const id of ids) {
          try {
            await apiRequest(`${DELETE_PATHS[kind]}/${encodeURIComponent(id)}`, {
              method: "DELETE",
              token,
            })
          } catch (error) {
            if (!firstFailure) firstFailure = messageOf(error)
          }
        }
        await load(token, "ledger")
        return firstFailure ? { ok: false, message: firstFailure } : { ok: true }
      },
      setUserRole: async (id, role) => {
        await send(`/api/users/${id}`, "PATCH", { role })
      },
      addCategory: (name) => asResult(send("/api/categories", "POST", { name })),
      addLocation: (input) => asResult(send("/api/locations", "POST", input)),
    }
  }, [state, session, ready, send, clearSession, load, token])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = React.useContext(StoreContext)
  if (!value) throw new Error("useStore must be used inside StoreProvider")
  return value
}
