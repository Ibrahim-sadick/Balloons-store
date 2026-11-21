import { describe, expect, it } from "vitest"
import { outstandingOf, statusFor, summarise } from "../../src/stock"

describe("summarise", () => {
  it("reports the whole quantity as available when nothing is out", () => {
    expect(summarise(5, 0, 0)).toEqual({ total: 5, issued: 0, maintenance: 0, available: 5 })
  })

  it("takes both issued and maintenance units out of availability", () => {
    expect(summarise(10, 3, 2)).toMatchObject({ issued: 3, maintenance: 2, available: 5 })
  })

  it("never reports negative availability when records disagree", () => {
    expect(summarise(2, 3, 0).available).toBe(0)
  })
})

describe("statusFor", () => {
  it("is available while any unit is on the shelf", () => {
    expect(statusFor(summarise(3, 2, 0))).toBe("available")
  })

  it("is checked_out when everything is with a borrower", () => {
    expect(statusFor(summarise(3, 3, 0))).toBe("checked_out")
  })

  it("is maintenance when the last units are with the technician", () => {
    expect(statusFor(summarise(3, 0, 3))).toBe("maintenance")
  })

  it("falls back to available for an empty record", () => {
    expect(statusFor(summarise(0, 0, 0))).toBe("available")
  })
})

describe("outstandingOf", () => {
  it("counts what is still out after a partial return", () => {
    expect(outstandingOf(3, 1)).toBe(2)
  })

  it("is zero once everything came back", () => {
    expect(outstandingOf(3, 3)).toBe(0)
  })

  it("is clamped at zero so an over-return cannot go negative", () => {
    expect(outstandingOf(3, 5)).toBe(0)
  })
})
