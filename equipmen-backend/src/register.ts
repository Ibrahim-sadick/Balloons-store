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

/** Next open checkout due date per asset, shown as the "due" column. */
async function nextDueByEquipment(db: Db) {
  const checkouts = await db.checkout.findMany({ include: { returns: true } })
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

/** Newest movement first: by return date when closed, otherwise by issue date. */
export function sortTransactions(rows: TransactionDto[]): TransactionDto[] {
  return [...rows].sort((left, right) => {
    const leftKey = left.returnedOn ?? left.issuedOn
    const rightKey = right.returnedOn ?? right.issuedOn
    return rightKey.localeCompare(leftKey)
  })
}

export async function listEquipment(db: Db, query = ""): Promise<EquipmentDto[]> {
  const search = query.trim().toLowerCase()
  const [items, stockMap, due] = await Promise.all([
    db.equipment.findMany({ orderBy: { name: "asc" } }),
    stockByEquipment(db),
    nextDueByEquipment(db),
  ])

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

/** Everything the signed-in UI needs on first paint. */
export async function registerSnapshot(db: Db) {
  const [equipment, categories, locations, checkouts, maintenance, activity, users] =
    await Promise.all([
      listEquipment(db),
      db.category.findMany({ orderBy: { name: "asc" } }),
      db.location.findMany({ orderBy: { name: "asc" } }),
      db.checkout.findMany({ include: { returns: true }, orderBy: { issuedOn: "desc" } }),
      db.maintenanceLog.findMany({ orderBy: { openedOn: "desc" } }),
      db.activityEvent.findMany({ orderBy: { at: "desc" }, take: 60 }),
      db.user.findMany({ orderBy: { name: "asc" } }),
    ])

  return {
    equipment,
    categories: categories.map(toCategoryDto),
    locations: locations.map(toLocationDto),
    transactions: sortTransactions(checkouts.flatMap(toTransactionDtos)),
    maintenance: maintenance.map(toMaintenanceDto),
    activity: activity.map(toActivityDto),
    users: users.map(toUserDto),
  }
}
