import type { Equipment, EquipmentStatus, MaintenanceLog, Transaction } from "@/lib/types"

export type ItemCount = {
  name: string
  total: number
  available: number
  issued: number
  returned: number
  maintenance: number
}

export function openMaintenanceQty(equipmentId: string, logs: MaintenanceLog[]) {
  return logs
    .filter((log) => log.equipmentId === equipmentId && log.status === "in_progress")
    .reduce((sum, log) => sum + (log.quantity ?? 1), 0)
}

export function countsFor(item: Equipment, transactions: Transaction[], logs?: MaintenanceLog[]): ItemCount {
  const mine = transactions.filter((entry) => entry.equipmentId === item.id)
  const issued = mine.filter((entry) => !entry.returnedOn).reduce((sum, entry) => sum + entry.quantity, 0)
  const returned = mine.filter((entry) => entry.returnedOn).reduce((sum, entry) => sum + entry.quantity, 0)
  const maintenance = logs ? openMaintenanceQty(item.id, logs) : item.maintenanceQty
  return {
    name: item.name,
    total: item.quantity,
    available: Math.max(0, item.quantity - issued - maintenance),
    issued,
    returned,
    maintenance,
  }
}

export function statusFor(counts: ItemCount): EquipmentStatus {
  if (counts.available > 0) return "available"
  if (counts.issued > 0) return "checked_out"
  if (counts.maintenance > 0) return "maintenance"
  return "available"
}

export function itemCounts(equipment: Equipment[], transactions: Transaction[]): ItemCount[] {
  const groups = new Map<string, ItemCount>()
  for (const item of equipment) {
    const counts = countsFor(item, transactions)
    const key = item.name.trim().toLowerCase() || "unnamed"
    const row = groups.get(key) ?? {
      name: item.name.trim() || "Unnamed",
      total: 0,
      available: 0,
      issued: 0,
      returned: 0,
      maintenance: 0,
    }
    row.total += counts.total
    row.available += counts.available
    row.issued += counts.issued
    row.returned += counts.returned
    row.maintenance += counts.maintenance
    groups.set(key, row)
  }
  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export function sumCounts(rows: ItemCount[]): ItemCount {
  return rows.reduce(
    (total, row) => ({
      name: "All items",
      total: total.total + row.total,
      available: total.available + row.available,
      issued: total.issued + row.issued,
      returned: total.returned + row.returned,
      maintenance: total.maintenance + row.maintenance,
    }),
    { name: "All items", total: 0, available: 0, issued: 0, returned: 0, maintenance: 0 },
  )
}
