import type { RequestHandler } from "express"

type Bucket = { count: number; resetAt: number }

/**
 * A small fixed-window limiter kept in process memory. It is enough for the one
 * store server this API runs on; if the API is ever scaled to several instances
 * this must move to a shared store such as Redis.
 *
 * `count: "refusals"` charges the window only when the route reports a refused
 * password through `res.locals.chargeRefusal()`, and empties it again through
 * `clearRefusals()` once the email and password were right. That is what keeps
 * a second device working: sign-in is the only door, every browser holds its
 * own session, and a new tab means a new sign-in - charging those would lock
 * the store out of its own door while an attacker guessing passwords still
 * meets exactly the same ceiling.
 */
export function rateLimit(options: {
  windowMs: number
  max: number
  message: string
  count?: "attempts" | "refusals"
}) {
  const buckets = new Map<string, Bucket>()
  const countsRefusals = options.count === "refusals"

  // Idle buckets are dropped so a long-running process does not grow forever.
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, options.windowMs)
  sweep.unref()

  const bucketFor = (key: string, now: number) => {
    const current = buckets.get(key)
    if (current && current.resetAt > now) return current
    const fresh: Bucket = { count: 0, resetAt: now + options.windowMs }
    buckets.set(key, fresh)
    return fresh
  }

  const handler: RequestHandler = (req, res, next) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown"
    const now = Date.now()
    const bucket = bucketFor(key, now)

    if (bucket.count >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      res.setHeader("Retry-After", String(retryAfter))
      res.status(429).json({ ok: false, message: options.message })
      return
    }

    if (countsRefusals) {
      // Looked up by key when the answer is known, because the sweep may have
      // closed this window between the request and the refusal.
      res.locals.chargeRefusal = () => {
        bucketFor(key, Date.now()).count += 1
      }
      res.locals.clearRefusals = () => {
        bucketFor(key, Date.now()).count = 0
      }
    } else {
      bucket.count += 1
    }

    next()
  }

  return handler
}

/**
 * Ten refused passwords per quarter of an hour, per client address. A correct
 * email and password never spends the budget, so one account can be signed in
 * on a phone, a tablet and the desk PC without any of them being told to wait.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many sign-in attempts. Wait a few minutes and try again.",
  count: "refusals",
})
