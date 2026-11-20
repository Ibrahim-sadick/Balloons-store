import type { Prisma } from "@prisma/client"
import { badRequest, notFound } from "./errors"

/** Inside `$transaction` use the callback client; outside use `prisma`. */
export type Db = Prisma.TransactionClient

export type StockSummary = {
  total: number
  issued: number
  maintenance: number
  available: number
}

export function summarise(quantity: number, issued: number, maintenance: number): StockSummary {
  return {
    total: quantity,
    issued,
    maintenance,
    available: Math.max(0, quantity - issued - maintenance),
  }
}

export function statusFor(stock: StockSummary): "available" | "checked_out" | "maintenance" {
  if (stock.available > 0) return "available"
  if (stock.issued > 0) return "checked_out"
  if (stock.maintenance > 0) return "maintenance"
  return "available"
}

/**
 * Units still out: every checkout contributes (issued - returned), so a fully
 * returned checkout contributes zero and a partial one contributes the rest.
 */
export async function outstandingQty(db: Db, equipmentId: string): Promise<number> {
  const rows = await db.$queryRaw<{ qty: unknown }[]>`
    SELECT CAST(COALESCE(SUM(c.quantity - COALESCE(r.qty, 0)), 0) AS SIGNED) AS qty
    FROM checkouts c
    LEFT JOIN (
      SELECT checkout_id, SUM(quantity) AS qty
      FROM check_returns
      GROUP BY checkout_id
    ) r ON r.checkout_id = c.id
    WHERE c.equipment_id = ${equipmentId}
  `
  return Number(rows[0]?.qty ?? 0)
}

export async function maintenanceQty(db: Db, equipmentId: string): Promise<number> {
  const result = await db.maintenanceLog.aggregate({
    where: { equipmentId, status: "in_progress" },
    _sum: { quantity: true },
  })
  return result._sum.quantity ?? 0
}

export async function stockFor(db: Db, equipmentId: string, total: number): Promise<StockSummary> {
  const [issued, maintenance] = await Promise.all([
    outstandingQty(db, equipmentId),
    maintenanceQty(db, equipmentId),
  ])
  return summarise(total, issued, maintenance)
}

/**
 * Locks the equipment row for the rest of the transaction. Without this two
 * storekeepers can both see "1 available" and both issue it.
 */
export async function lockEquipment(db: Db, equipmentId: string): Promise<{ id: string; quantity: number }> {
  const rows = await db.$queryRaw<{ id: string; quantity: number }[]>`
    SELECT id, quantity FROM equipment WHERE id = ${equipmentId} FOR UPDATE
  `
  const row = rows[0]
  if (!row) throw notFound("That asset is no longer in the register.")
  return { id: row.id, quantity: Number(row.quantity) }
}

/** One aggregate query for the whole register, used by the list endpoint. */
export async function stockByEquipment(
  db: Db,
): Promise<Map<string, { issued: number; maintenance: number }>> {
  const rows = await db.$queryRaw<
    { id: string; issued: unknown; maintenance: unknown }[]
  >`
    SELECT e.id AS id,
           CAST(COALESCE(o.qty, 0) AS SIGNED) AS issued,
           CAST(COALESCE(m.qty, 0) AS SIGNED) AS maintenance
    FROM equipment e
    LEFT JOIN (
      SELECT c.equipment_id AS id, SUM(c.quantity - COALESCE(r.qty, 0)) AS qty
      FROM checkouts c
      LEFT JOIN (
        SELECT checkout_id, SUM(quantity) AS qty
        FROM check_returns
        GROUP BY checkout_id
      ) r ON r.checkout_id = c.id
      GROUP BY c.equipment_id
    ) o ON o.id = e.id
    LEFT JOIN (
      SELECT equipment_id AS id, SUM(quantity) AS qty
      FROM maintenance_logs
      WHERE status = 'in_progress'
      GROUP BY equipment_id
    ) m ON m.id = e.id
  `

  const map = new Map<string, { issued: number; maintenance: number }>()
  for (const row of rows) {
    map.set(row.id, { issued: Number(row.issued), maintenance: Number(row.maintenance) })
  }
  return map
}

/** BLN-10001, TX-00001, IN-00001, MN-0001 — read and bumped under a row lock. */
export async function nextSequence(db: Db, name: string, floor: number): Promise<number> {
  await db.$executeRaw`
    INSERT INTO counters (name, value) VALUES (${name}, ${floor})
    ON DUPLICATE KEY UPDATE value = value
  `
  const rows = await db.$queryRaw<{ value: unknown }[]>`
    SELECT value FROM counters WHERE name = ${name} FOR UPDATE
  `
  const next = Number(rows[0]?.value ?? floor) + 1
  await db.$executeRaw`UPDATE counters SET value = ${next} WHERE name = ${name}`
  if (!Number.isInteger(next) || next < 1) throw badRequest("Could not allocate the next reference.")
  return next
}

export async function recordActivity(
  db: Db,
  input: { actorId: string | null; actorName: string; summary: string; equipmentId?: string | null },
) {
  await db.activityEvent.create({
    data: {
      actorId: input.actorId,
      actorName: input.actorName,
      summary: input.summary,
      equipmentId: input.equipmentId ?? null,
    },
  })
}
