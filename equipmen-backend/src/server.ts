import { createApp } from "./app"
import { env } from "./env"
import { prisma } from "./db"

const app = createApp()

const server = app.listen(env.port, () => {
  console.log(`equipmen-backend listening on http://localhost:${env.port}`)
  console.log(`Allowed frontend origins: ${env.corsOrigins.join(", ") || "any"}`)
})

async function shutdown(signal: string) {
  console.log(`${signal} received, closing the store API.`)
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0))
  })
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
