/**
 * Excel and Sheets execute any cell that starts with =, +, - or @. A store name
 * such as "=HYPERLINK(...)" must stay text, so it gets an apostrophe prefix,
 * which both programs strip when the file is opened.
 */
function cellText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function escapeCell(value: string) {
  return `"${cellText(value).replaceAll('"', '""')}"`
}

export function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const source = text.replace(/^\uFEFF/, "")
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") {
      cell += char
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((value) => value.trim()))
}

export type EquipmentCsvRow = {
  line: number
  name: string
  serialNumber: string
  quantity: string
  categoryName: string
  locationName: string
  manufacturer: string
  model: string
  condition: string
  acquiredOn: string
  notes: string
}

const headerAliases: Record<string, keyof Omit<EquipmentCsvRow, "line">> = {
  name: "name",
  equipment: "name",
  number: "quantity",
  qty: "quantity",
  quantity: "quantity",
  count: "quantity",
  serial: "serialNumber",
  "serial number": "serialNumber",
  category: "categoryName",
  location: "locationName",
  "home location": "locationName",
  manufacturer: "manufacturer",
  maker: "manufacturer",
  model: "model",
  condition: "condition",
  acquired: "acquiredOn",
  "acquired on": "acquiredOn",
  notes: "notes",
  note: "notes",
}

export function equipmentRowsFromCsv(text: string): EquipmentCsvRow[] {
  const table = parseCsv(text)
  if (table.length === 0) return []
  const header = table[0].map((cell) => headerAliases[cell.trim().toLowerCase()])
  const hasHeader = header.includes("name")
  const body = hasHeader ? table.slice(1) : table
  return body.map((cells, index) => {
    const line = hasHeader ? index + 2 : index + 1
    const read = (key: keyof Omit<EquipmentCsvRow, "line">, fallbackIndex: number) => {
      if (hasHeader) {
        const column = header.indexOf(key)
        return column >= 0 ? cells[column] ?? "" : ""
      }
      return cells[fallbackIndex] ?? ""
    }
    return {
      line,
      name: read("name", 0).trim(),
      quantity: read("quantity", 1).trim(),
      serialNumber: read("serialNumber", 2).trim(),
      categoryName: read("categoryName", 3).trim(),
      locationName: read("locationName", 4).trim(),
      manufacturer: read("manufacturer", 5).trim(),
      model: read("model", 6).trim(),
      condition: read("condition", 7).trim(),
      acquiredOn: read("acquiredOn", 8).trim(),
      notes: read("notes", 9).trim(),
    }
  })
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
