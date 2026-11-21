import express, { type NextFunction, type Request, type Response } from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { Prisma } from "@prisma/client"
import { env } from "./env"
import { prisma } from "./db"
import { ApiError } from "./errors"
import { authRouter } from "./routes/auth.routes"
import { bootstrapRouter } from "./routes/bootstrap.routes"
import { checkoutRouter } from "./routes/checkouts.routes"
import { equipmentRouter } from "./routes/equipment.routes"
import { maintenanceRouter } from "./routes/maintenance.routes"
import { settingsRouter } from "./routes/settings.routes"

export function createApp() {
  const app = express()

  app.disable("x-powered-by")
  // Baseline hardening without a helmet dependency: JSON responses only, never
  // framed, never sniffed, and no HSTS before the connection is actually TLS.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader("Referrer-Policy", "no-referrer")
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if (env.isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    }
    next()
  })
  app.use(
    cors({
      // A tablet opens the app at http://192.168.1.7:3000 and the browser sends
      // that as the Origin, so a localhost-only allow-list never matches it. That
      // is what made the app look broken on every device except this one.
      origin: (requestOrigin, callback) => callback(null, isAllowedOrigin(requestOrigin)),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: "1mb" }))
  app.use(cookieParser())

  // Liveness plus a database probe, so a deploy can tell the two failures apart.
  app.get("/api/health", async (_req: Request, res: Response) => {
    let database: "connected" | "unreachable"
    try {
      await prisma.$queryRaw`SELECT 1`
      database = "connected"
    } catch {
      database = "unreachable"
    }
    res.json({ ok: true, service: "equipmen-backend", database, time: new Date().toISOString() })
  })

  app.use("/api/auth", authRouter)
  app.use("/api/bootstrap", bootstrapRouter)
  app.use("/api/equipment", equipmentRouter)
  app.use("/api/checkouts", checkoutRouter)
  app.use("/api/maintenance", maintenanceRouter)
  app.use("/api", settingsRouter)

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ ok: false, message: "No such endpoint." })
  })

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({ ok: false, message: error.message })
      return
    }
    // express.json() rejects broken payloads with its own error type; answer 400, not 500.
    const parserError = error as { type?: string }
    if (parserError?.type === "entity.parse.failed") {
      res.status(400).json({ ok: false, message: "That request was not valid JSON." })
      return
    }
    if (parserError?.type === "entity.too.large") {
      res.status(413).json({ ok: false, message: "That request is too large." })
      return
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ ok: false, message: "That value is already in use." })
      return
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      res.status(503).json({
        ok: false,
        message: "The store database is unreachable. Start MySQL and try again.",
      })
      return
    }
    console.error("[api]", error)
    res.status(500).json({ ok: false, message: "The store server hit an error. Try again." })
  })

  return app
}

/**
 * Which origins may call the API. `CORS_ORIGIN` still wins for anything unusual
 * (a LAN hostname, a tunnel, a real domain); otherwise the store's own local
 * network is trusted so any phone, tablet or second PC on the same Wi-Fi works.
 * Public origins stay refused: the session also rides in an httpOnly cookie, so
 * reflecting every origin would let another site reuse a signed-in browser.
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true // curl, server-to-server and native shells send none
  if (env.corsOrigins.includes(origin)) return true

  let host: string
  try {
    const url = new URL(origin)
    if (url.protocol !== "http:" && url.protocol !== "https:") return false
    host = url.hostname.replace(/^\[|\]$/g, "")
  } catch {
    return false
  }

  if (host === "localhost" || host === "::1") return true

  const octets = host.split(".")
  if (octets.length !== 4) return false
  const numbers = octets.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN))
  if (numbers.some((value) => Number.isNaN(value) || value > 255)) return false

  const first = numbers[0]
  const second = numbers[1]
  if (first === undefined || second === undefined) return false
  // 10/8, 172.16/12 and 192.168/16 are the private ranges a shop Wi-Fi hands out;
  // 127/8 is the machine itself. 169.254/16 is deliberately left out.
  return (
    first === 127 ||
    first === 10 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  )
}
