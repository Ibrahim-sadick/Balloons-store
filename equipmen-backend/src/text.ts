/** "balloon envelope" -> "Balloon envelope". Used for CSV imports only. */
export function sentenceCase(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ")
  if (!cleaned) return ""
  const lower = cleaned.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** Deterministic short code: "Balloon envelope" -> "BAE", "Basket" -> "BAS". */
export function codeFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "GEN"
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
