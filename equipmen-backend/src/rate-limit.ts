import type { RequestHandler } from "express"

type Bucket = { count: number; resetAt: number }

/**
 * A small fixed-window limiter kept in process memory. It is enough for the one
 * store server this API runs on; if the API is ever scaled to several instances
 * this must move to a shared store such as Redis.
 */
export function rateLimit(options: {
  windowMs: number
  max: number
  message: string
}): RequestHandler {
  const buckets = new Map<string, Bucket>()

  // Idle buckets are dropped so a long-running process does not grow forever.
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, options.windowMs)
  sweep.unref()

  return (req, res, next) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown"
    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      return next()
    }

    bucket.count += 1
    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      res.setHeader("Retry-After", String(retryAfter))
      res.status(429).json({ ok: false, message: options.message })
      return
    }

    return next()
  }
}

/** Ten attempts per quarter of an hour, per client address. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many sign-in attempts. Wait a few minutes and try again.",
})
