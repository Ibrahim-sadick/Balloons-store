import { Router } from "express"
import type { Condition } from "@prisma/client"
import { prisma } from "../db"
import { asyncHandler, today, toDate } from "../http"
import { badRequest, conflict, notFound } from "../errors"
import {
  createEquipmentSchema,
  importSchema,
  parseBody,
  updateEquipmentSchema,
  type ImportRow,
} from "../validation"
import { requireAuth, requireWriter } from "../auth"
import {
  lockEquipment,
  nextSequence,
  recordActivity,
  stockFor,
  summarise,
  type Db,
} from "../stock"
import { toEquipmentDto } from "../dto"
import { listEquipment } from "../register"
import { codeFromName, sentenceCase, tidyLabel } from "../text"

export const equipmentRouter = Router()
equipmentRouter.use(requireAuth)

const CONDITIONS: Condition[] = ["New", "Excellent", "Good", "Fair", "Poor", "Damaged"]

async function resolveCategory(db: Db, input: { categoryId?: string; categoryName?: string }) {
  if (input.categoryId) {
    const found = await db.category.findUnique({ where: { id: input.categoryId } })
    if (found) return found
  }
  const name = input.categoryName?.trim()
  if (!name) throw badRequest("Enter a category for this asset.")
  const existing = await db.category.findFirst({ where: { name } })
  if (existing) return existing

  const taken = new Set((await db.category.findMany({ select: { code: true } })).map((entry) => entry.code))
  const base = codeFromName(name)
  let code = base
  let suffix = 1
  while (taken.has(code)) {
    code = `${base.slice(0, 3)}${suffix}`.slice(0, 6)
    suffix += 1
  }
  return db.category.create({ data: { name: sentenceCase(name), code } })
}

async function resolveLocation(
  db: Db,
  input: { locationId?: string; locationName?: string; locationZone?: string },
) {
  if (input.locationId) {
    const found = await db.location.findUnique({ where: { id: input.locationId } })
    if (found) return found
  }
  const name = input.locationName?.trim()
  if (!name) throw badRequest("Enter a home location for this asset.")
  const existing = await db.location.findFirst({ where: { name } })
  if (existing) return existing

  const taken = new Set((await db.location.findMany({ select: { code: true } })).map((entry) => entry.code))
  const base = codeFromName(name)
  let code = base
  let suffix = 1
  while (taken.has(code)) {
    code = `${base.slice(0, 3)}${suffix}`.slice(0, 6)
    suffix += 1
  }
  return db.location.create({
    data: { name: sentenceCase(name), code, zone: input.locationZone?.trim() || null },
  })
}

async function uniqueSerial(db: Db, serial: string | undefined, ignoreId?: string) {
  const value = serial?.trim()
  if (!value) return null
  const clash = await db.equipment.findFirst({
    where: { serialNumber: value, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
  })
  if (clash) throw conflict(`Serial ${value} is already on the register.`)
  return value
}

type PreparedImportRow = {
  line: number
  name: string
  quantity: number
  serial: string
  categoryName: string
  locationName: string
  manufacturer: string
  model: string
  condition: Condition
  acquiredOn: string
  notes: string
}

/**
 * Everything that can be judged without touching the database. Runs before the
 * write so a bad file reports every problem with its line number instead of
 * rolling back halfway through.
 */
function prepareImport(rows: ImportRow[]): {
  accepted: PreparedImportRow[]
  skipped: { line: number; message: string }[]
} {
  const accepted: PreparedImportRow[] = []
  const skipped: { line: number; message: string }[] = []
  const serialLines = new Map<string, number>()

  for (const row of rows) {
    const quantity = row.quantity.trim() ? Number(row.quantity) : 1

    if (!row.name) {
      skipped.push({ line: row.line, message: "Name is required." })
      continue
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      skipped.push({
        line: row.line,
        message: "Number must be a whole number such as 5, 10, or 50.",
      })
      continue
    }
    if (!row.categoryName || !row.locationName) {
      skipped.push({ line: row.line, message: "Category and location are required." })
      continue
    }

    const serial = row.serialNumber.trim()
    if (serial) {
      const earlier = serialLines.get(serial.toLowerCase())
      if (earlier !== undefined) {
        skipped.push({
          line: row.line,
          message: `Serial ${serial} already appears on line ${earlier} of this file.`,
        })
        continue
      }
      serialLines.set(serial.toLowerCase(), row.line)
    }

    // A row dated after today would file equipment the store has not received
    // yet, so it is reported back with its line number instead of being stored.
    const acquiredOn = /^\d{4}-\d{2}-\d{2}$/.test(row.acquiredOn) ? row.acquiredOn : today()
    if (acquiredOn > today()) {
      skipped.push({ line: row.line, message: "The acquired date cannot be later than today." })
      continue
    }

    accepted.push({
      line: row.line,
      name: tidyLabel(row.name),
      quantity,
      serial,
      categoryName: row.categoryName,
      locationName: row.locationName,
      manufacturer: row.manufacturer ? tidyLabel(row.manufacturer) : "",
      model: row.model,
      condition:
        CONDITIONS.find((entry) => entry.toLowerCase() === row.condition.toLowerCase()) ?? "Good",
      acquiredOn,
      notes: row.notes,
    })
  }

  return { accepted, skipped }
}

equipmentRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, equipment: await listEquipment(prisma, String(req.query.q ?? "")) })
  }),
)

equipmentRouter.post(
  "/",
  requireWriter,
  asyncHandler(async (req, res) => {
    const input = parseBody(createEquipmentSchema, req.body)
    const actor = req.user!

    const created = await prisma.$transaction(async (tx) => {
      const category = await resolveCategory(tx, input)
      const location = await resolveLocation(tx, input)
      const serial = await uniqueSerial(tx, input.serialNumber)
      const assetTag = `BLN-${await nextSequence(tx, "assetTag", 10000)}`

      const item = await tx.equipment.create({
        data: {
          assetTag,
          name: input.name,
          categoryId: category.id,
          locationId: location.id,
          serialNumber: serial,
          manufacturer: input.manufacturer?.trim() || null,
          model: input.model?.trim() || null,
          condition: input.condition,
          acquiredOn: toDate(input.acquiredOn || today()),
          notes: input.notes?.trim() ?? "",
          quantity: input.quantity,
        },
      })

      await recordActivity(tx, {
        actorId: actor.id,
        actorName: actor.name,
        summary: `Added ${item.quantity} ${item.name} to the register as ${item.assetTag}.`,
        equipmentId: item.id,
      })

      return item
    })

    res.status(201).json({
      ok: true,
      equipment: toEquipmentDto(created, summarise(created.quantity, 0, 0)),
    })
  }),
)

equipmentRouter.patch(
  "/:id",
  requireWriter,
  asyncHandler(async (req, res) => {
    const id = req.params.id
    const patch = parseBody(updateEquipmentSchema, req.body)
    const actor = req.user!

    const updated = await prisma.$transaction(async (tx) => {
      const locked = await lockEquipment(tx, id)
      const existing = await tx.equipment.findUniqueOrThrow({ where: { id } })

      if (patch.quantity !== undefined) {
        const stock = await stockFor(tx, id, locked.quantity)
        if (patch.quantity < stock.issued + stock.maintenance) {
          throw badRequest(
            "The number cannot be lower than the units that are issued or in maintenance.",
          )
        }
      }

      if (patch.categoryId) {
        const category = await tx.category.findUnique({ where: { id: patch.categoryId } })
        if (!category) throw notFound("That category no longer exists.")
      }
      if (patch.locationId) {
        const location = await tx.location.findUnique({ where: { id: patch.locationId } })
        if (!location) throw notFound("That location no longer exists.")
      }

      const serial =
        patch.serialNumber !== undefined ? await uniqueSerial(tx, patch.serialNumber, id) : undefined

      const item = await tx.equipment.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
          ...(patch.locationId !== undefined ? { locationId: patch.locationId } : {}),
          ...(serial !== undefined ? { serialNumber: serial } : {}),
          ...(patch.manufacturer !== undefined
            ? { manufacturer: patch.manufacturer.trim() || null }
            : {}),
          ...(patch.model !== undefined ? { model: patch.model.trim() || null } : {}),
          ...(patch.condition !== undefined ? { condition: patch.condition } : {}),
          ...(patch.acquiredOn !== undefined ? { acquiredOn: toDate(patch.acquiredOn) } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
          ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
        },
      })

      await recordActivity(tx, {
        actorId: actor.id,
        actorName: actor.name,
        summary: `Updated the record for ${existing.assetTag}.`,
        equipmentId: item.id,
      })

      const stock = await stockFor(tx, item.id, item.quantity)
      return { item, stock }
    })

    res.json({ ok: true, equipment: toEquipmentDto(updated.item, updated.stock) })
  }),
)

equipmentRouter.post(
  "/import",
  requireWriter,
  asyncHandler(async (req, res) => {
    const { rows } = parseBody(importSchema, req.body)
    const actor = req.user!
    const { accepted: candidates, skipped } = prepareImport(rows)

    // One lookup for the whole file instead of one query per row.
    const serials = candidates.map((row) => row.serial).filter(Boolean)
    const onRegister = new Set<string>()
    if (serials.length > 0) {
      const existing = await prisma.equipment.findMany({
        where: { serialNumber: { in: serials } },
        select: { serialNumber: true },
      })
      for (const item of existing) {
        if (item.serialNumber) onRegister.add(item.serialNumber.toLowerCase())
      }
    }

    const accepted = candidates.filter((row) => {
      if (row.serial && onRegister.has(row.serial.toLowerCase())) {
        skipped.push({
          line: row.line,
          message: `Serial ${row.serial} is already on the register.`,
        })
        return false
      }
      return true
    })
    skipped.sort((left, right) => left.line - right.line)

    let addedUnits = 0

    await prisma.$transaction(
      async (tx) => {
        // Categories and locations repeat across rows, so each name is resolved once.
        const categoryIds = new Map<string, string>()
        const locationIds = new Map<string, string>()

        for (const row of accepted) {
          const categoryKey = row.categoryName.toLowerCase()
          let categoryId = categoryIds.get(categoryKey)
          if (!categoryId) {
            categoryId = (await resolveCategory(tx, { categoryName: row.categoryName })).id
            categoryIds.set(categoryKey, categoryId)
          }

          const locationKey = row.locationName.toLowerCase()
          let locationId = locationIds.get(locationKey)
          if (!locationId) {
            locationId = (await resolveLocation(tx, { locationName: row.locationName })).id
            locationIds.set(locationKey, locationId)
          }

          const assetTag = `BLN-${await nextSequence(tx, "assetTag", 10000)}`
          await tx.equipment.create({
            data: {
              assetTag,
              name: row.name,
              categoryId,
              locationId,
              serialNumber: row.serial || null,
              manufacturer: row.manufacturer || null,
              model: row.model || null,
              condition: row.condition,
              acquiredOn: toDate(row.acquiredOn),
              notes: row.notes,
              quantity: row.quantity,
            },
          })

          addedUnits += row.quantity
        }

        if (accepted.length > 0) {
          const totals = await tx.equipment.aggregate({ _sum: { quantity: true } })
          await recordActivity(tx, {
            actorId: actor.id,
            actorName: actor.name,
            summary: `Uploaded ${addedUnits} units from CSV. The register now has ${totals._sum.quantity ?? 0}.`,
          })
        }
      },
      // A 500-row file issues a few statements per row; the 5 s default is far too tight.
      { maxWait: 10_000, timeout: 120_000 },
    )

    const totals = await prisma.equipment.aggregate({ _sum: { quantity: true } })

    res.json({
      ok: true,
      added: addedUnits,
      total: totals._sum.quantity ?? 0,
      skipped,
    })
  }),
)

/**
 * Removing an asset takes its movements and repair logs with it: a check-out
 * row cannot outlive the item it points at. The counts are returned so the
 * screen can say exactly what went, and the operator has confirmed it in the
 * dialog before the request is ever sent.
 */
equipmentRouter.delete(
  "/:id",
  requireWriter,
  asyncHandler(async (req, res) => {
    const actor = req.user!
    const id = String(req.params.id)

    const removed = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM equipment WHERE id = ${id} FOR UPDATE
      `
      if (!locked[0]) throw notFound("That asset is no longer in the register.")

      const item = await tx.equipment.findUniqueOrThrow({ where: { id } })
      const [checkins, checkouts, repairs] = await Promise.all([
        tx.checkReturn.count({ where: { checkout: { equipmentId: item.id } } }),
        tx.checkout.count({ where: { equipmentId: item.id } }),
        tx.maintenanceLog.count({ where: { equipmentId: item.id } }),
      ])

      await tx.checkReturn.deleteMany({ where: { checkout: { equipmentId: item.id } } })
      await tx.checkout.deleteMany({ where: { equipmentId: item.id } })
      await tx.maintenanceLog.deleteMany({ where: { equipmentId: item.id } })
      await tx.equipment.delete({ where: { id: item.id } })

      await recordActivity(tx, {
        actorId: actor.id,
        actorName: actor.name,
        summary: `Deleted ${item.assetTag} ${item.name} with ${checkouts} check-out${checkouts === 1 ? "" : "s"}, ${checkins} check-in${checkins === 1 ? "" : "s"} and ${repairs} repair log${repairs === 1 ? "" : "s"}.`,
        equipmentId: null,
      })

      return { assetTag: item.assetTag, name: item.name, units: item.quantity, checkouts, checkins, repairs }
    })

    res.json({ ok: true, removed })
  }),
)
