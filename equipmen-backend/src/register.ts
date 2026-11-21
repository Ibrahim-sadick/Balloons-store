import type { CheckReturn, Checkout, Equipment } from "@prisma/client"
import { fromDate } from "./http"
import { stockByEquipment, summarise, type Db } from "./stock"
import {
  toActivityDto,
  toCategoryDto,
  toEquipmentDto,
  toLocationDto,
  toMaintenanceDto,
  toTransactionDtos,
  toUserDto,
  type EquipmentDto,
  type TransactionDto,
} from "./dto"

export type CheckoutWithReturns = Checkout & { returns: CheckReturn[] }

/** Newest movement first: by return date when closed, otherwise by issue date. */
export function sortTransactions(rows: TransactionDto[]): TransactionDto[] {
  return [...rows].sort((left, right) => {
    const leftKey = left.returnedOn ?? left.issuedOn
    const rightKey = right.returnedOn ?? right.issuedOn
    return rightKey.localeCompare(leftKey)
  })
}

/** Everything check-outs are needed for, loaded once per request. */
function loadCheckouts(db: Db): Promise<CheckoutWithReturns[]> {
  return db.checkout.findMany({ include: { returns: true }, orderBy: { issuedOn: "desc" } })
}

/** Next open checkout due date per asset, shown as the "due" column. */
function nextDueFrom(checkouts: CheckoutWithReturns[]) {
  const due = new Map<string, string>()
  for (const checkout of checkouts) {
    const returned = checkout.returns.reduce((sum, entry) => sum + entry.quantity, 0)
    if (returned >= checkout.quantity) continue
    const date = fromDate(checkout.expectedReturn) ?? ""
    const current = due.get(checkout.equipmentId)
    if (!current || date < current) due.set(checkout.equipmentId, date)
  }
  return due
}

function buildEquipment(
  items: Equipment[],
  stockMap: Map<string, { issued: number; maintenance: number }>,
  due: Map<string, string>,
  query: string,
): EquipmentDto[] {
  const search = query.trim().toLowerCase()

  return items
    .map((item) => {
      const stock = stockMap.get(item.id) ?? { issued: 0, maintenance: 0 }
      return toEquipmentDto(
        item,
        summarise(item.quantity, stock.issued, stock.maintenance),
        due.get(item.id) ?? null,
      )
    })
    .filter((row) => {
      if (!search) return true
      return `${row.name} ${row.assetTag} ${row.serialNumber} ${row.manufacturer} ${row.model}`
        .toLowerCase()
        .includes(search)
    })
}

export async function listEquipment(
  db: Db,
  query = "",
  checkouts?: CheckoutWithReturns[],
): Promise<EquipmentDto[]> {
  const [items, stockMap, history] = await Promise.all([
    db.equipment.findMany({ orderBy: { name: "asc" } }),
    stockByEquipment(db),
    checkouts ?? loadCheckouts(db),
  ])

  return buildEquipment(items, stockMap, nextDueFrom(history), query)
}

/** Everything the signed-in UI needs on first paint. */
export async function registerSnapshot(db: Db) {
  const [items, stockMap, categories, locations, checkouts, maintenance, activity, users] =
    await Promise.all([
      db.equipment.findMany({ orderBy: { name: "asc" } }),
      stockByEquipment(db),
      db.category.findMany({ orderBy: { name: "asc" } }),
      db.location.findMany({ orderBy: { name: "asc" } }),
      loadCheckouts(db),
      db.maintenanceLog.findMany({ orderBy: { openedOn: "desc" } }),
      db.activityEvent.findMany({ orderBy: { at: "desc" }, take: 60 }),
      db.user.findMany({ orderBy: { name: "asc" } }),
    ])

  return {
    equipment: buildEquipment(items, stockMap, nextDueFrom(checkouts), ""),
    categories: categories.map(toCategoryDto),
    locations: locations.map(toLocationDto),
    transactions: sortTransactions(checkouts.flatMap(toTransactionDtos)),
    maintenance: maintenance.map(toMaintenanceDto),
    activity: activity.map(toActivityDto),
    users: users.map(toUserDto),
  }
}

/**
 * The part of the snapshot a check-out or a repair can change. Users, categories
 * and locations only move when someone edits settings, so refreshing after every
 * movement on the ledger stays small.
 */
export async function ledgerSnapshot(db: Db) {
  const [items, stockMap, checkouts, maintenance, activity] = await Promise.all([
    db.equipment.findMany({ orderBy: { name: "asc" } }),
    stockByEquipment(db),
    loadCheckouts(db),
    db.maintenanceLog.findMany({ orderBy: { openedOn: "desc" } }),
    db.activityEvent.findMany({ orderBy: { at: "desc" }, take: 60 }),
  ])

  return {
    equipment: buildEquipment(items, stockMap, nextDueFrom(checkouts), ""),
    transactions: sortTransactions(checkouts.flatMap(toTransactionDtos)),
    maintenance: maintenance.map(toMaintenanceDto),
    activity: activity.map(toActivityDto),
  }
}
