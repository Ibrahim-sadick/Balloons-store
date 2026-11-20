import { Router } from "express"
import { prisma } from "../db"
import { asyncHandler } from "../http"
import { conflict, forbidden, notFound } from "../errors"
import { categorySchema, locationSchema, parseBody, roleSchema } from "../validation"
import { requireAdmin, requireAuth, requireWriter } from "../auth"
import { toCategoryDto, toLocationDto, toUserDto } from "../dto"
import { codeFromName, sentenceCase } from "../text"

export const settingsRouter = Router()
settingsRouter.use(requireAuth)

settingsRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { name: "asc" } })
    res.json({ ok: true, users: users.map(toUserDto) })
  }),
)

settingsRouter.patch(
  "/users/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { role } = parseBody(roleSchema, req.body)
    if (req.params.id === req.user!.id && role !== "ADMIN") {
      throw forbidden("You cannot remove your own administrator role.")
    }
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!existing) throw notFound("That account is no longer on the list.")

    const user = await prisma.user.update({ where: { id: existing.id }, data: { role } })
    res.json({ ok: true, user: toUserDto(user) })
  }),
)

settingsRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } })
    res.json({ ok: true, categories: categories.map(toCategoryDto) })
  }),
)

settingsRouter.post(
  "/categories",
  requireWriter,
  asyncHandler(async (req, res) => {
    const input = parseBody(categorySchema, req.body)
    const existing = await prisma.category.findFirst({ where: { name: input.name } })
    if (existing) throw conflict("That category is already on the list.")

    const taken = new Set((await prisma.category.findMany({ select: { code: true } })).map((entry) => entry.code))
    const base = (input.code || codeFromName(input.name)).toUpperCase()
    let code = base
    let suffix = 1
    while (taken.has(code)) {
      code = `${base.slice(0, 3)}${suffix}`.slice(0, 6)
      suffix += 1
    }

    const category = await prisma.category.create({
      data: { name: sentenceCase(input.name), code },
    })
    res.status(201).json({ ok: true, category: toCategoryDto(category) })
  }),
)

settingsRouter.get(
  "/locations",
  asyncHandler(async (_req, res) => {
    const locations = await prisma.location.findMany({ orderBy: { name: "asc" } })
    res.json({ ok: true, locations: locations.map(toLocationDto) })
  }),
)

settingsRouter.post(
  "/locations",
  requireWriter,
  asyncHandler(async (req, res) => {
    const input = parseBody(locationSchema, req.body)
    const existing = await prisma.location.findFirst({ where: { name: input.name } })
    if (existing) throw conflict("That location is already on the list.")

    const taken = new Set((await prisma.location.findMany({ select: { code: true } })).map((entry) => entry.code))
    const base = (input.code || codeFromName(input.name)).toUpperCase()
    let code = base
    let suffix = 1
    while (taken.has(code)) {
      code = `${base.slice(0, 3)}${suffix}`.slice(0, 6)
      suffix += 1
    }

    const location = await prisma.location.create({
      data: { name: sentenceCase(input.name), code, zone: input.zone?.trim() || null },
    })
    res.status(201).json({ ok: true, location: toLocationDto(location) })
  }),
)
