import { Router } from "express"
import bcrypt from "bcryptjs"
import { prisma } from "../db"
import { asyncHandler } from "../http"
import { parseBody, loginSchema } from "../validation"
import { SESSION_COOKIE, requireAuth, signToken } from "../auth"
import { unauthorized } from "../errors"
import { toUserDto } from "../dto"
import { env } from "../env"

export const authRouter = Router()

// Compared against when the email is unknown so a wrong email and a wrong
// password take the same amount of time.
const DUMMY_HASH = bcrypt.hashSync("balons-store-dummy-password", 10)

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body)
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH)
      throw unauthorized("No store account matches that email.")
    }

    const matches = await bcrypt.compare(password, user.passwordHash)
    if (!matches) throw unauthorized("Password does not match this account.")

    const dto = toUserDto(user)
    const token = signToken(dto)
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.json({ ok: true, token, user: dto })
  }),
)

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) throw unauthorized("Your account is no longer active. Sign in again.")
    res.json({ ok: true, user: toUserDto(user) })
  }),
)

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { sameSite: "lax", secure: env.corsOrigins.length > 0 })
  res.json({ ok: true })
})
