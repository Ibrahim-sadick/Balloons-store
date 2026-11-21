function localDate(now: Date) {
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

/**
 * The real calendar date. Drives defaults, overdue checks and printed receipts.
 * Read on every call, not stored at module load, so a tab left open overnight
 * does not keep using yesterday.
 */
export function storeToday(): string {
  return localDate(new Date())
}

export type EquipmentStatus = "available" | "checked_out" | "maintenance"
export type Condition = "New" | "Excellent" | "Good" | "Fair" | "Poor" | "Damaged"
export type Role = "ADMIN" | "STOREKEEPER" | "VIEWER"
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed"
export type MaintenanceType = "Inspection" | "Calibration" | "Repair" | "Service" | "Gas refill"

export type Equipment = {
  id: string
  assetTag: string
  name: string
  categoryId: string
  status: EquipmentStatus
  locationId: string
  serialNumber: string
  manufacturer: string
  model: string
  condition: Condition
  acquiredOn: string
  expectedReturn: string | null
  notes: string
  quantity: number
  maintenanceQty: number
}

export type Transaction = {
  id: string
  equipmentId: string
  issuedTo: string
  issuedBy: string
  issuedOn: string
  expectedReturn: string
  returnedOn: string | null
  conditionOut: Condition
  conditionIn: Condition | null
  returnedBy: string | null
  notes: string
  damageNoted: boolean
  quantity: number
}

export type MaintenanceLog = {
  id: string
  equipmentId: string
  type: MaintenanceType
  status: MaintenanceStatus
  openedOn: string
  completedOn: string | null
  technician: string
  notes: string
  quantity: number
}

export type ActivityEvent = {
  id: string
  at: string
  actor: string
  summary: string
  equipmentId: string | null
}

export type StaffUser = {
  id: string
  name: string
  email: string
  role: Role
}

export type Category = {
  id: string
  name: string
  code: string
}

export type StoreLocation = {
  id: string
  name: string
  code: string
  zone: string
}

export type Result = { ok: true } | { ok: false; message: string; denied?: boolean }
