import type { NextFunction, Request, RequestHandler, Response } from "express"

/** Express 4 does not forward rejected promises; this does. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next)
  }
}

export function today(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

/** "2026-11-20" -> Date at UTC midnight, which is what @db.Date expects. */
export function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

/** Date -> "2026-11-20" in UTC, the inverse of toDate. */
export function fromDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

/** Dashboard activity stamps use the same "YYYY-MM-DDTHH:mm" shape the UI prints. */
export function stamp(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
