import { Router } from "express"
import { prisma } from "../db"
import { asyncHandler, toDate } from "../http"
import { badRequest, notFound } from "../errors"
import { completeMaintenanceSchema, createMaintenanceSchema, parseBody } from "../validation"
import { requireAuth, requireWriter } from "../auth"
import { lockEquipment, nextSequence, recordActivity, stockFor } from "../stock"
import { toMaintenanceDto } from "../dto"

/** "GasRefill" reads badly in the activity feed; everything else is already a word. */
function humanType(type: string): string {
  return type === "GasRefill" ? "gas refill" : type.toLowerCase()
}

export const maintenanceRouter = Router()
maintenanceRouter.use(requireAuth)

maintenanceRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "all")
    const filter = (["scheduled", "in_progress", "completed"] as const).find(
      (entry) => entry === status,
    )
    const logs = await prisma.maintenanceLog.findMany({
      where: filter ? { status: filter } : undefined,
      orderBy: { openedOn: "desc" },
    })
    res.json({ ok: true, maintenance: logs.map(toMaintenanceDto) })
  }),
)

maintenanceRouter.post(
  "/",
  requireWriter,
  asyncHandler(async (req, res) => {
    const input = parseBody(createMaintenanceSchema, req.body)
    const actor = req.user!

    const created = await prisma.$transaction(async (tx) => {
      const locked = await lockEquipment(tx, input.equipmentId)
      const item = await tx.equipment.findUniqueOrThrow({ where: { id: locked.id } })

      if (input.status !== "completed") {
        const stock = await stockFor(tx, item.id, locked.quantity)
        if (input.quantity > stock.available) {
          throw badRequest(`Only ${stock.available} ${item.name} are free for maintenance.`)
        }
      }

      const ref = `MN-${String(await nextSequence(tx, "maintenance", 0)).padStart(4, "0")}`
      const log = await tx.maintenanceLog.create({
        data: {
          ref,
          equipmentId: item.id,
          type: input.type === "Gas refill" ? "GasRefill" : input.type,
          status: input.status,
          quantity: input.quantity,
          technician: input.technician,
          openedOn: toDate(input.openedOn),
          completedOn: input.status === "completed" ? toDate(input.openedOn) : null,
          notes: input.notes?.trim() ?? "",
        },
      })

      await recordActivity(tx, {
        actorId: actor.id,
        actorName: actor.name,
        summary: `Logged ${input.type.toLowerCase()} for ${input.quantity} ${item.name}.`,
        equipmentId: item.id,
      })

      return log
    })

    res.status(201).json({ ok: true, maintenance: toMaintenanceDto(created) })
  }),
)

maintenanceRouter.post(
  "/:id/complete",
  requireWriter,
  asyncHandler(async (req, res) => {
    const input = parseBody(completeMaintenanceSchema, req.body)
    const actor = req.user!

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.maintenanceLog.findUnique({ where: { id: req.params.id } })
      if (!existing) throw notFound("That maintenance job is no longer on record.")
      if (existing.status === "completed") throw badRequest("That job is already closed.")

      const item = await tx.equipment.findUnique({ where: { id: existing.equipmentId } })

      const log = await tx.maintenanceLog.update({
        where: { id: existing.id },
        data: {
          status: "completed",
          completedOn: toDate(input.completedOn),
          notes: input.notes?.trim()
            ? `${existing.notes} Closed: ${input.notes.trim()}`.trim()
            : existing.notes,
        },
      })

      await recordActivity(tx, {
        actorId: actor.id,
        actorName: actor.name,
        // The DB enum says GasRefill; the store says "gas refill".
        summary: item
          ? `Completed ${humanType(existing.type)} for ${item.name}.`
          : `Completed ${humanType(existing.type)} for ${existing.quantity} units.`,
        equipmentId: existing.equipmentId,
      })

      return log
    })

    res.json({ ok: true, maintenance: toMaintenanceDto(updated) })
  }),
)

/** Removes one repair log. An in-progress log that goes away releases its units. */
maintenanceRouter.delete(
  "/:id",
  requireWriter,
  asyncHandler(async (req, res) => {
    const actor = req.user!
    const id = String(req.params.id)

    const removed = await prisma.$transaction(async (tx) => {
      const log = await tx.maintenanceLog.findUnique({ where: { id } })
      if (!log) throw notFound("That maintenance job is no longer on record.")

      await lockEquipment(tx, log.equipmentId)
      const item = await tx.equipment.findUnique({ where: { id: log.equipmentId } })

      await tx.maintenanceLog.delete({ where: { id: log.id } })

      await recordActivity(tx, {
        actorId: actor.id,
        actorName: actor.name,
        summary: item
          ? `Deleted the ${humanType(log.type)} log for ${log.quantity} ${item.name}.`
          : `Deleted the ${humanType(log.type)} log for ${log.quantity} units.`,
        equipmentId: log.equipmentId,
      })

      return { ref: log.ref, units: log.quantity, status: log.status }
    })

    res.json({ ok: true, removed })
  }),
)
