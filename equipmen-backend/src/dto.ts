import type {
  ActivityEvent,
  Category,
  Checkout,
  CheckReturn,
  Condition,
  Equipment,
  Location,
  MaintenanceLog,
  User,
} from "@prisma/client"
import { fromDate, stamp } from "./http"
import { statusFor, type StockSummary } from "./stock"

export type EquipmentDto = {
  id: string
  assetTag: string
  name: string
  categoryId: string
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
  status: "available" | "checked_out" | "maintenance"
}

export function toEquipmentDto(
  equipment: Equipment,
  stock: StockSummary,
  expectedReturn: string | null = null,
): EquipmentDto {
  return {
    id: equipment.id,
    assetTag: equipment.assetTag,
    name: equipment.name,
    categoryId: equipment.categoryId,
    locationId: equipment.locationId,
    serialNumber: equipment.serialNumber ?? "",
    manufacturer: equipment.manufacturer ?? "",
    model: equipment.model ?? "",
    condition: equipment.condition,
    acquiredOn: fromDate(equipment.acquiredOn) ?? "",
    expectedReturn,
    notes: equipment.notes,
    quantity: equipment.quantity,
    maintenanceQty: stock.maintenance,
    status: statusFor(stock),
  }
}

export type TransactionDto = {
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

type CheckoutWithReturns = Checkout & { returns: CheckReturn[] }

/**
 * The register reads out movements the way the UI has always shown them: one
 * row for whatever is still out, plus one row per return. The issued quantity
 * is never overwritten, so history stays accurate.
 */
export function toTransactionDtos(checkout: CheckoutWithReturns): TransactionDto[] {
  const base: Omit<TransactionDto, "id" | "quantity" | "returnedOn" | "conditionIn" | "returnedBy" | "damageNoted" | "notes"> = {
    equipmentId: checkout.equipmentId,
    issuedTo: checkout.issuedTo,
    issuedBy: checkout.issuedBy,
    issuedOn: fromDate(checkout.issuedOn) ?? "",
    expectedReturn: fromDate(checkout.expectedReturn) ?? "",
    conditionOut: checkout.conditionOut,
  }

  const rows: TransactionDto[] = []
  const returnedTotal = checkout.returns.reduce((sum, entry) => sum + entry.quantity, 0)
  const outstanding = Math.max(0, checkout.quantity - returnedTotal)

  if (outstanding > 0) {
    rows.push({
      ...base,
      id: checkout.id,
      quantity: outstanding,
      returnedOn: null,
      conditionIn: null,
      returnedBy: null,
      damageNoted: false,
      notes: checkout.notes,
    })
  }

  for (const entry of checkout.returns) {
    const combined = entry.notes
      ? `${checkout.notes} Return: ${entry.notes}`.trim()
      : checkout.notes
    rows.push({
      ...base,
      id: `${checkout.id}:${entry.id}`,
      quantity: entry.quantity,
      returnedOn: fromDate(entry.returnedOn),
      conditionIn: entry.conditionIn,
      returnedBy: entry.returnedBy,
      damageNoted: entry.damageNoted,
      notes: combined,
    })
  }

  return rows
}

export function toMaintenanceDto(log: MaintenanceLog) {
  return {
    id: log.id,
    equipmentId: log.equipmentId,
    // The UI and the printed reports say "Gas refill"; MySQL enums cannot hold a space.
    type: log.type === "GasRefill" ? "Gas refill" : log.type,
    status: log.status,
    openedOn: fromDate(log.openedOn) ?? "",
    completedOn: fromDate(log.completedOn),
    technician: log.technician,
    notes: log.notes,
    quantity: log.quantity,
  }
}

export function toActivityDto(event: ActivityEvent) {
  return {
    id: event.id,
    at: stamp(event.at),
    actor: event.actorName,
    summary: event.summary,
    equipmentId: event.equipmentId,
  }
}

export function toUserDto(user: User) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export function toCategoryDto(category: Category) {
  return { id: category.id, name: category.name, code: category.code }
}

export function toLocationDto(location: Location) {
  return { id: location.id, name: location.name, code: location.code, zone: location.zone ?? "" }
}
