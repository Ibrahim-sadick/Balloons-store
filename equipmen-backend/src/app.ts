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
  app.use(
    cors({
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: "1mb" }))
  app.use(cookieParser())

  // Liveness plus a database probe, so a deploy can tell the two failures apart.
  app.get("/api/health", async (_req: Request, res: Response) => {
    let database: "connected" | "unreachable" = "unreachable"
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
