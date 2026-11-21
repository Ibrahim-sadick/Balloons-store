export type ExcelCell = string | number

/** A line under the data: a label alone is a bold section heading. */
export type ExcelSummary = { label: string; value?: ExcelCell }

export type XlsxOptions = {
  /** Report heading printed in the first row, in bold. */
  title?: string
  /** Totals block appended below the data, after one blank row. */
  summary?: ExcelSummary[]
}

const encoder = new TextEncoder()

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function dosStamp(date: Date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/** Minimal ZIP writer: stored (no compression) entries, which .xlsx readers accept. */
function zip(files: { name: string; data: Uint8Array }[]) {
  const stamp = dosStamp(new Date())
  const parts: Uint8Array[] = []
  const directory: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const checksum = crc32(file.data)

    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, stamp.time, true)
    localView.setUint16(12, stamp.date, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, file.data.length, true)
    localView.setUint32(22, file.data.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true)
    local.set(name, 30)

    const entry = new Uint8Array(46 + name.length)
    const entryView = new DataView(entry.buffer)
    entryView.setUint32(0, 0x02014b50, true)
    entryView.setUint16(4, 20, true)
    entryView.setUint16(6, 20, true)
    entryView.setUint16(8, 0x0800, true)
    entryView.setUint16(10, 0, true)
    entryView.setUint16(12, stamp.time, true)
    entryView.setUint16(14, stamp.date, true)
    entryView.setUint32(16, checksum, true)
    entryView.setUint32(20, file.data.length, true)
    entryView.setUint32(24, file.data.length, true)
    entryView.setUint16(28, name.length, true)
    entryView.setUint16(30, 0, true)
    entryView.setUint16(32, 0, true)
    entryView.setUint16(34, 0, true)
    entryView.setUint16(36, 0, true)
    entryView.setUint32(38, 0, true)
    entryView.setUint32(42, offset, true)
    entry.set(name, 46)

    parts.push(local, file.data)
    directory.push(entry)
    offset += local.length + file.data.length
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, directorySize, true)
  endView.setUint32(16, offset, true)
  endView.setUint16(20, 0, true)

  const stream = [...parts, ...directory, end]
  const total = stream.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let cursor = 0
  for (const part of stream) {
    output.set(part, cursor)
    cursor += part.length
  }
  return output
}

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function columnName(index: number) {
  let name = ""
  let cursor = index + 1
  while (cursor > 0) {
    const remainder = (cursor - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    cursor = Math.floor((cursor - 1) / 26)
  }
  return name
}

function sheetTitle(value: string) {
  const cleaned = value.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31)
  return cleaned || "Report"
}

function cellXml(reference: string, value: ExcelCell, bold: boolean) {
  const style = bold ? ' s="1"' : ""
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${style}><v>${value}</v></c>`
  }
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`
}

/**
 * Arial Narrow at 10 pt for every cell, plus one bold face for the report title
 * and the column headings. A machine without Arial Narrow falls back to its
 * default sans-serif, so the numbers still read.
 */
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial Narrow"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial Narrow"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

type SheetRow = { cells: ExcelCell[]; bold?: boolean }

/** Builds a valid single-sheet .xlsx workbook in memory. */
export function buildXlsx(
  headers: ExcelCell[],
  rows: ExcelCell[][],
  sheetName = "Report",
  options: XlsxOptions = {},
) {
  const sheetRows: SheetRow[] = []
  if (options.title) sheetRows.push({ cells: [options.title], bold: true })
  sheetRows.push({ cells: headers, bold: true })
  for (const row of rows) sheetRows.push({ cells: row })
  if (options.summary?.length) {
    sheetRows.push({ cells: [] })
    for (const line of options.summary) {
      sheetRows.push(line.value === undefined ? { cells: [line.label], bold: true } : { cells: [line.label, line.value] })
    }
  }

  const sheetRowsXml = sheetRows
    .map((row, rowIndex) => {
      const cells = row.cells
        .map((value, columnIndex) => cellXml(`${columnName(columnIndex)}${rowIndex + 1}`, value, Boolean(row.bold)))
        .join("")
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join("")

  const parts = [
    {
      name: "[Content_Types].xml",
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetTitle(sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", body: stylesXml },
    {
      name: "xl/worksheets/sheet1.xml",
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRowsXml}</sheetData></worksheet>`,
    },
  ]

  return zip(parts.map((part) => ({ name: part.name, data: encoder.encode(part.body) })))
}

export function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: ExcelCell[],
  rows: ExcelCell[][],
  options: XlsxOptions = {},
) {
  const bytes = buildXlsx(headers, rows, sheetName, options)
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
