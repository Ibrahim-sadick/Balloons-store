import { Router } from "express"
import { prisma } from "../db"
import { asyncHandler, today, toDate } from "../http"
import { badRequest, notFound } from "../errors"
import { createCheckoutSchema, createReturnSchema, parseBody } from "../validation"
import { requireAuth, requireWriter } from "../auth"
import { lockEquipment, nextSequence, recordActivity, stockFor } from "../stock"
import { toTransactionDtos } from "../dto"

export const checkoutRouter = Router()
checkoutRouter.use(requireAuth)

checkoutRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "all")
    const from = String(req.query.from ?? "").trim()
    const to = String(req.query.to ?? "").trim()

    const checkouts = await prisma.checkout.findMany({
      include: { returns: true },
      orderBy: { issuedOn: "desc" },
    })

    const rows = checkouts
      .flatMap(toTransactionDtos)
      .filter((row) => {
        if (status === "out" && row.returnedOn) return false
        if (status === "in" && !row.returnedOn) return false
        const marker = row.returnedOn ?? row.issuedOn
        if (from && marker < from) return false
        if (to && marker > to) return false
        return true
      })
      .sort((left, right) => {
        const leftKey = left.returnedOn ?? left.issuedOn
        const rightKey = right.returnedOn ?? right.issuedOn
        return rightKey.localeCompare(leftKey)
      })

    res.json({ ok: true, transactions: rows })
  }),
)

checkoutRouter.post(
  "/",
  requireWriter,
  asyncHandler(async (req, res) => {
    const input = parseBody(createCheckoutSchema, req.body)
    const actor = req.user!

    if (input.expectedReturn < today()) {
      throw badRequest("Expected return cannot be before the store date.")
    }

    const created = await prisma.$transaction(async (tx) => {
      const locked = await lockEquipment(tx, input.equipmentId)
      const item = await tx.equipment.findUniqueOrThrow({ where: { id: locked.id } })
      const stock = await stockFor(tx, item.id, locked.quantity)

      if (input.quantity > stock.available) {
        throw badRequest(`Only ${stock.available} ${item.name} are available to issue.`)
      }

      const ref = `TX-${String(await nextSequence(tx, "checkout", 0)).padStart(5, "0")}`
      const checkout = await tx.checkout.create({
        data: {
          ref,
          equipmentId: item.id,
          quantity: input.quantity,
          issuedTo: input.issuedTo,
          issuedBy: actor.name,
          issuedOn: toDate(today()),
          expectedReturn: toDate(input.expectedReturn),
          conditionOut: input.conditionOut,
          notes: input.notes?.trim() ?? "",
        },
        include: { returns: true },
      })

      // The register shows the condition recorded at hand-over.
      await tx.equipment.update({
        where: { id: item.id },
        data: { condition: input.conditionOut },
      })

      await recordActivity(tx, {
        actorId: actor.id,
        actorName: actor.name,
        summary: `Issued ${input.quantity} ${item.name} to ${input.issuedTo}, due ${input.expectedReturn}.`,
        equipmentId: item.id,
      })

      return checkout
    })

    res.status(201).json({ ok: true, transactions: toTransactionDtos(created) })
  }),
)

checkoutRouter.post(
  "/:id/returns",
  requireWriter,
  asyncHandler(async (req, res) => {
    const input = parseBody(createReturnSchema, req.body)
    const actor = req.user!

    const created = await prisma.$transaction(async (tx) => {
      // Lock the check-out row first: two simultaneous check-ins must not both
      // believe the full quantity is still outstanding and over-return it.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM checkouts WHERE id = ${req.params.id} FOR UPDATE
      `
      if (!locked[0]) throw notFound("That check-out is no longer on record.")

      const checkout = await tx.checkout.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { returns: true },
      })

      const returned = checkout.returns.reduce((sum, entry) => sum + entry.quantity, 0)
      const outstanding = checkout.quantity - returned
      if (outstanding <= 0) throw badRequest("That check-out is already closed.")
      if (input.quantity > outstanding) {
        throw badRequest(`Only ${outstanding} are out on this check-out.`)
      }

      const item = await tx.equipment.findUnique({ where: { id: checkout.equipmentId } })
      const damaged = input.conditionIn === "Damaged"
      const ref = `IN-${String(await nextSequence(tx, "checkin", 0)).padStart(5, "0")}`

      const entry = await tx.checkReturn.create({
        data: {
          ref,
          checkoutId: checkout.id,
          quantity: input.quantity,
          returnedOn: toDate(input.returnedOn),
          returnedBy: input.returnedBy,
          conditionIn: input.conditionIn,
          damageNoted: damaged,
          notes: input.notes?.trim() ?? "",
        },
      })

      // Anything that comes back damaged goes straight into repair, so the
      // units leave availability instead of quietly rejoining the shelf.
      if (damaged && item) {
        const maintenanceRef = `MN-${String(await nextSequence(tx, "maintenance", 0)).padStart(4, "0")}`
        await tx.maintenanceLog.create({
          data: {
            ref: maintenanceRef,
            equipmentId: item.id,
            type: "Repair",
            status: "in_progress",
            quantity: input.quantity,
            technician: input.returnedBy,
            openedOn: toDate(input.returnedOn),
            notes: input.notes?.trim() ? `Returned damaged. ${input.notes.trim()}` : "Returned damaged.",
          },
        })
      }

      await recordActivity(tx, {
        actorId: actor.id,
        actorName: actor.name,
        summary: item
          ? `Checked in ${input.quantity} ${item.name} from ${checkout.issuedTo}.`
          : `Checked in ${input.quantity} from ${checkout.issuedTo}.`,
        equipmentId: checkout.equipmentId,
      })

      return { entry, checkout: { ...checkout } }
    })

    res.status(201).json({
      ok: true,
      checkin: {
        id: created.entry.id,
        ref: created.entry.ref,
        quantity: created.entry.quantity,
        returnedOn: input.returnedOn,
        returnedBy: created.entry.returnedBy,
        conditionIn: created.entry.conditionIn,
        damageNoted: created.entry.damageNoted,
      },
    })
  }),
)
