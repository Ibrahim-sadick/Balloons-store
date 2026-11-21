import { storeToday } from "@/lib/types"

export function inRange(date: string, from: string, to: string) {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function isPastDue(expected: string | null, asOf = storeToday()) {
  if (!expected) return false
  return expected < asOf
}

export function formatWhen(value: string) {
  if (value.length === 10) return value
  return value.replace("T", " ").slice(0, 16)
}

export function sentenceCase(value: string) {
  const index = value.search(/\S/)
  if (index < 0) return value.toLowerCase()
  return value.slice(0, index) + value.charAt(index).toUpperCase() + value.slice(index + 1).toLowerCase()
}

export function codeFromName(name: string) {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase()
  return (letters.slice(0, 4) || "GEN").padEnd(3, "X")
}
