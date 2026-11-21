import { describe, expect, it } from "vitest"
import {
  createReturnSchema,
  importSchema,
  loginSchema,
  parseBody,
} from "../../src/validation"

describe("loginSchema", () => {
  it("accepts a plain store email", () => {
    expect(loginSchema.parse({ email: "admin@ballons.store", password: "secret" })).toEqual({
      email: "admin@ballons.store",
      password: "secret",
    })
  })

  it("rejects a malformed email before any lookup happens", () => {
    expect(loginSchema.safeParse({ email: "admin", password: "secret" }).success).toBe(false)
  })

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "admin@ballons.store", password: "" }).success).toBe(false)
  })
})

describe("createReturnSchema", () => {
  const valid = {
    quantity: 1,
    returnedOn: "2026-11-20",
    returnedBy: "Pilot A",
    conditionIn: "Good",
    notes: "",
  }

  it("accepts a normal return", () => {
    expect(createReturnSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects zero or fractional quantities", () => {
    expect(createReturnSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false)
    expect(createReturnSchema.safeParse({ ...valid, quantity: 1.5 }).success).toBe(false)
  })

  it("rejects a date that is not ISO", () => {
    expect(createReturnSchema.safeParse({ ...valid, returnedOn: "20/11/2026" }).success).toBe(false)
  })

  it("rejects an unknown condition", () => {
    expect(createReturnSchema.safeParse({ ...valid, conditionIn: "Broken" }).success).toBe(false)
  })
})

describe("importSchema", () => {
  const row = {
    line: 2,
    name: "Basket",
    quantity: "1",
    serialNumber: "",
    categoryName: "Baskets",
    locationName: "Store",
    manufacturer: "",
    model: "",
    condition: "Good",
    acquiredOn: "2026-11-20",
    notes: "",
  }

  it("accepts a small file", () => {
    expect(importSchema.safeParse({ rows: [row] }).success).toBe(true)
  })

  it("refuses an empty file", () => {
    expect(importSchema.safeParse({ rows: [] }).success).toBe(false)
  })

  it("caps a single upload at 500 rows", () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({ ...row, line: index + 2 }))
    expect(importSchema.safeParse({ rows }).success).toBe(false)
  })
})

describe("parseBody", () => {
  it("turns the first zod problem into a 400 with a readable message", () => {
    try {
      parseBody(loginSchema, { email: "admin", password: "secret" })
      throw new Error("should have thrown")
    } catch (error) {
      expect(error).toMatchObject({ status: 400, message: "Enter a valid email." })
    }
  })
})
