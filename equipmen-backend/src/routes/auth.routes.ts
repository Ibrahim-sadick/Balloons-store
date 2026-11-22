import { Router } from "express"
import bcrypt from "bcryptjs"
import { prisma } from "../db"
import { asyncHandler } from "../http"
import { parseBody, loginSchema } from "../validation"
import { SESSION_COOKIE, requireAuth, signToken } from "../auth"
import { unauthorized } from "../errors"
import { toUserDto } from "../dto"
import { env } from "../env"
import { loginLimiter } from "../rate-limit"

export const authRouter = Router()

// Compared against when the email is unknown so a wrong email and a wrong
// password take the same amount of time.
const DUMMY_HASH = bcrypt.hashSync("balons-store-dummy-password", 10)

// One message for both failures: telling them apart would confirm which emails
// have accounts, and would make the timing protection above pointless.
const INVALID_CREDENTIALS = "Email or password is incorrect."

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.isProduction,
  path: "/",
}

/**
 * What the sign-in limiter hands the route: it cannot know the answer itself.
 * `charge` spends one of the refused-password slots and `clear` wipes what an
 * earlier run of attempts had spent, so a correct email and password is free.
 */
type LoginLimits = {
  chargeRefusal?: () => void
  clearRefusals?: () => void
}

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body)
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    const limits = res.locals as LoginLimits

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH)
      limits.chargeRefusal?.()
      throw unauthorized(INVALID_CREDENTIALS)
    }

    const matches = await bcrypt.compare(password, user.passwordHash)
    if (!matches) {
      limits.chargeRefusal?.()
      throw unauthorized(INVALID_CREDENTIALS)
    }

    limits.clearRefusals?.()
    const dto = toUserDto(user)
    const token = signToken(dto)
    res.cookie(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 })
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
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS)
  res.json({ ok: true })
})
