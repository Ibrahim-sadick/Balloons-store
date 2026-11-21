import { Router } from "express"
import { prisma } from "../db"
import { asyncHandler } from "../http"
import { requireAuth } from "../auth"
import { listEquipment, ledgerSnapshot, registerSnapshot } from "../register"

export const bootstrapRouter = Router()
bootstrapRouter.use(requireAuth)

/** One round-trip for the whole register; the store is small enough for it. */
bootstrapRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    // After a check-out only the ledger moved, so settings tables can be skipped.
    if (req.query.scope === "ledger") {
      res.json({ ok: true, ...(await ledgerSnapshot(prisma)) })
      return
    }
    res.json({ ok: true, ...(await registerSnapshot(prisma)) })
  }),
)

bootstrapRouter.get(
  "/equipment",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, equipment: await listEquipment(prisma, String(req.query.q ?? "")) })
  }),
)

bootstrapRouter.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 60) || 60, 1), 200)
    const events = await prisma.activityEvent.findMany({
      orderBy: { at: "desc" },
      take: limit,
    })
    res.json({
      ok: true,
      activity: events.map((event) => ({
        id: event.id,
        at: event.at.toISOString(),
        actor: event.actorName,
        summary: event.summary,
        equipmentId: event.equipmentId,
      })),
    })
  }),
)
