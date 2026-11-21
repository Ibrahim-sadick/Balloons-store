import jwt from "jsonwebtoken"
import type { NextFunction, Request, Response } from "express"
import type { Role } from "@prisma/client"
import { env } from "./env"
import { prisma } from "./db"
import { forbidden, unauthorized } from "./errors"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

export const SESSION_COOKIE = "balons_token"

export function signToken(user: SessionUser): string {
  return jwt.sign({ name: user.name, email: user.email, role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: "7d",
  })
}

function readToken(req: Request): string {
  const header = req.headers.authorization
  if (header?.startsWith("Bearer ")) return header.slice(7).trim()
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE]
  return typeof cookie === "string" ? cookie : ""
}

/**
 * Every route below /api except /auth/login and /health requires a storekeeper.
 * The account is re-read on each request so a deleted user or a changed role
 * takes effect immediately instead of at token expiry.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req)
  if (!token) return next(unauthorized("Sign in to continue."))

  let userId: string
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload
    if (!payload.sub) return next(unauthorized("Your session has expired. Sign in again."))
    userId = String(payload.sub)
  } catch {
    return next(unauthorized("Your session has expired. Sign in again."))
  }

  prisma.user
    .findUnique({ where: { id: userId } })
    .then((user) => {
      if (!user) {
        return next(unauthorized("Your account is no longer active. Sign in again."))
      }
      req.user = { id: user.id, name: user.name, email: user.email, role: user.role }
      return next()
    })
    .catch(next)
}

/** VIEWER accounts may read everything and change nothing. */
export function requireWriter(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role === "VIEWER") {
    return next(forbidden("Viewers can read the register, not change it."))
  }
  return next()
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") return next(forbidden("Only an administrator can do that."))
  return next()
}
