import { describe, expect, it, vi } from "vitest"
import type { NextFunction, Request, RequestHandler, Response } from "express"
import { rateLimit } from "../../src/rate-limit"

/**
 * Drives the middleware with just the parts it touches: the client address and
 * an Express response stub.
 */
function call(handler: RequestHandler, ip = "10.0.0.1") {
  const res = {
    locals: {} as Record<string, () => void>,
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  }
  res.status.mockReturnValue(res)

  let passed = false
  const next: NextFunction = () => {
    passed = true
  }

  handler({ ip, socket: { remoteAddress: ip } } as unknown as Request, res as unknown as Response, next)

  return {
    passed,
    locals: res.locals,
    setHeader: res.setHeader,
    status: res.status,
    json: res.json,
  }
}

const limiter = () =>
  rateLimit({ windowMs: 60_000, max: 3, message: "Slow down." })

describe("rateLimit", () => {
  it("lets the first attempts through", () => {
    const handler = limiter()
    expect(call(handler).passed).toBe(true)
    expect(call(handler).passed).toBe(true)
    expect(call(handler).passed).toBe(true)
  })

  it("blocks the attempt after the limit with 429 and Retry-After", () => {
    const handler = limiter()
    call(handler)
    call(handler)
    call(handler)

    const blocked = call(handler)
    expect(blocked.passed).toBe(false)
    expect(blocked.status).toHaveBeenCalledWith(429)
    expect(blocked.json).toHaveBeenCalledWith({ ok: false, message: "Slow down." })
    expect(blocked.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String))
  })

  it("keeps one client's attempts away from another's", () => {
    const handler = limiter()
    call(handler, "10.0.0.1")
    call(handler, "10.0.0.1")
    call(handler, "10.0.0.1")

    expect(call(handler, "10.0.0.1").passed).toBe(false)
    expect(call(handler, "10.0.0.2").passed).toBe(true)
  })

  it("forgets attempts once the window has passed", () => {
    vi.useFakeTimers()
    try {
      const handler = limiter()
      call(handler)
      call(handler)
      call(handler)
      expect(call(handler).passed).toBe(false)

      vi.advanceTimersByTime(60_001)
      expect(call(handler).passed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("rateLimit counting refusals", () => {
  const refusalLimiter = () =>
    rateLimit({ windowMs: 60_000, max: 2, message: "Slow down.", count: "refusals" })

  it("does not charge a sign-in that is never refused", () => {
    const handler = refusalLimiter()
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(call(handler).passed).toBe(true)
    }
  })

  it("blocks only after the allowed refusals are used up", () => {
    const handler = refusalLimiter()
    call(handler).locals.chargeRefusal?.()
    call(handler).locals.chargeRefusal?.()
    expect(call(handler).passed).toBe(false)
  })

  it("empties what earlier refusals spent once a password is right", () => {
    const handler = refusalLimiter()
    call(handler).locals.chargeRefusal?.()
    // One refusal is already spent; a correct sign-in wipes it before the
    // window can close, so the next two slots are both available again.
    call(handler).locals.clearRefusals?.()
    call(handler).locals.chargeRefusal?.()
    call(handler).locals.chargeRefusal?.()
    expect(call(handler).passed).toBe(false)
  })
})
