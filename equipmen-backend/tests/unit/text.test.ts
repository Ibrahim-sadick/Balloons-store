import { describe, expect, it } from "vitest"
import { codeFromName, sentenceCase, tidyLabel } from "../../src/text"

describe("sentenceCase", () => {
  it("capitalises the first letter and lowercases the rest", () => {
    expect(sentenceCase("BALLOON ENVELOPE")).toBe("Balloon envelope")
  })

  it("collapses repeated spaces and trims", () => {
    expect(sentenceCase("  gas   refill ")).toBe("Gas refill")
  })

  it("returns an empty string for blank input", () => {
    expect(sentenceCase("   ")).toBe("")
  })
})

describe("tidyLabel", () => {
  it("tidies text that was typed in all lower case", () => {
    expect(tidyLabel("dji")).toBe("Dji")
  })

  it("leaves acronyms that already carry capitals alone", () => {
    expect(tidyLabel("DJI")).toBe("DJI")
  })

  it("does not lowercase the rest of a mixed-case label", () => {
    expect(tidyLabel("  DJI   Phantom 4 ")).toBe("DJI Phantom 4")
  })
})

describe("codeFromName", () => {
  it("takes the initials of up to three words", () => {
    expect(codeFromName("Balloon Envelope Replacement")).toBe("BER")
  })

  it("takes the first three letters of a single word", () => {
    expect(codeFromName("Basket")).toBe("BAS")
  })

  it("falls back to GEN for blank input", () => {
    expect(codeFromName("   ")).toBe("GEN")
  })
})
