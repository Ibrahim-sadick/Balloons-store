import "dotenv/config"

function text(name: string, fallback?: string): string {
  const value = process.env[name]?.trim()
  if (value) return value
  if (fallback !== undefined) return fallback
  throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.`)
}

function port(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a port number, received "${raw}".`)
  }
  return value
}

export const env = {
  // Both of these must fail at boot: a blank URL turns into a confusing auth
  // error on the first query, and a blank secret would make tokens forgeable.
  databaseUrl: text("DATABASE_URL"),
  port: port("PORT", 4000),
  corsOrigins: text("CORS_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
  jwtSecret: text("JWT_SECRET"),
}
