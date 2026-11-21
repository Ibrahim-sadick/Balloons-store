import { describe, expect, it } from "vitest"
import type { Checkout, CheckReturn } from "@prisma/client"
import { toTransactionDtos } from "../../src/dto"

const DAY = new Date("2026-11-01T00:00:00.000Z")

function checkout(overrides: Partial<Checkout & { returns: CheckReturn[] }> = {}): Checkout & {
  returns: CheckReturn[]
} {
  return {
    id: "co_1",
    ref: "TX-00001",
    equipmentId: "eq_1",
    quantity: 3,
    issuedTo: "Pilot A",
    issuedBy: "Storekeeper",
    issuedOn: DAY,
    expectedReturn: DAY,
    conditionOut: "Good",
    notes: "Issued for the morning flight",
    createdAt: DAY,
    returns: [],
    ...overrides,
  }
}

function checkReturn(overrides: Partial<CheckReturn> = {}): CheckReturn {
  return {
    id: "cr_1",
    ref: "IN-00001",
    checkoutId: "co_1",
    quantity: 1,
    returnedOn: DAY,
    returnedBy: "Pilot A",
    conditionIn: "Good",
    damageNoted: false,
    notes: "",
    createdAt: DAY,
    ...overrides,
  }
}

describe("toTransactionDtos", () => {
  it("shows one open row while nothing has come back", () => {
    const rows = toTransactionDtos(checkout())

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: "co_1",
      quantity: 3,
      returnedOn: null,
      conditionIn: null,
    })
  })

  it("keeps the remainder out and adds a row per return", () => {
    const rows = toTransactionDtos(checkout({ returns: [checkReturn()] }))

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: "co_1", quantity: 2, returnedOn: null })
    expect(rows[1]).toMatchObject({
      id: "co_1:cr_1",
      quantity: 1,
      returnedOn: "2026-11-01",
      conditionIn: "Good",
    })
  })

  it("drops the open row once the full quantity is back", () => {
    const rows = toTransactionDtos(
      checkout({ returns: [checkReturn({ quantity: 3, damageNoted: true, notes: "Torn seam" })] }),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ quantity: 3, damageNoted: true })
    expect(rows[0]?.notes).toContain("Torn seam")
  })

  it("sums several partial returns before deciding what is still out", () => {
    const rows = toTransactionDtos(
      checkout({
        returns: [
          checkReturn({ id: "cr_1", quantity: 1 }),
          checkReturn({ id: "cr_2", quantity: 1 }),
        ],
      }),
    )

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ id: "co_1", quantity: 1 })
  })
})
