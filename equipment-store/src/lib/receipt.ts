import { STORE_TODAY } from "@/lib/types"

export type EquipmentReceipt = {
  name: string
  category: string
  location: string
  condition: string
  total: number
  available: number
  issued: number
  returned: number
  maintenance: number
  notes: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function line(label: string, value: string) {
  return `<p class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></p>`
}

export function equipmentReceiptHtml(receipt: EquipmentReceipt) {
  const notes = receipt.notes.trim()
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body {
      width: 58mm;
      margin: 0 auto;
      padding: 2.5mm 3mm 5mm;
      font-family: "Courier New", Courier, monospace;
      font-size: 9.5px;
      font-weight: 400;
      line-height: 1.32;
      text-align: center;
    }
    p { margin: 0; font-weight: 400; }
    .store { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
    .kicker { margin-top: 1px; font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; }
    .muted { font-size: 8.5px; }
    .rule { border: 0; border-top: 1px dashed #000; margin: 2.2mm 0; }
    .row { display: flex; justify-content: space-between; gap: 2mm; text-align: left; }
    .row span { min-width: 0; }
    .row span:first-child { overflow-wrap: anywhere; }
    .row span:last-child { text-align: right; white-space: nowrap; }
    .item { margin-bottom: 0.6mm; font-size: 10px; letter-spacing: 0.02em; text-transform: uppercase; }
    .label { text-align: left; font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; }
    .notes { margin-top: 0.8mm; text-align: left; overflow-wrap: anywhere; }
    .end { margin-top: 3mm; font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; }
  </style>
</head>
<body>
  <p class="store">Shine Balloon Safaris</p>
  <p class="kicker">Equipment receipt</p>
  <p class="muted">${escapeHtml(STORE_TODAY)}</p>
  <hr class="rule" />
  <p class="item">${escapeHtml(receipt.name)}</p>
  ${line("Category", receipt.category || "—")}
  ${line("Location", receipt.location || "—")}
  ${line("Condition", receipt.condition)}
  <hr class="rule" />
  ${line("Number", String(receipt.total))}
  ${line("Available", String(receipt.available))}
  ${line("Issued", String(receipt.issued))}
  ${line("Returned", String(receipt.returned))}
  ${line("Maintenance", String(receipt.maintenance))}
  <hr class="rule" />
  <p class="label">Notes</p>
  <p class="notes">${escapeHtml(notes || "—")}</p>
  <hr class="rule" />
  <p class="end">End of receipt</p>
</body>
</html>`
}

export function printThermalReceipt(html: string) {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.setAttribute("title", "Thermal receipt")
  frame.style.position = "fixed"
  frame.style.top = "0"
  frame.style.left = "-10000px"
  frame.style.width = "219px"
  frame.style.height = "720px"
  frame.style.border = "0"
  frame.style.pointerEvents = "none"

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    frame.remove()
  }

  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const view = frame.contentWindow
  if (!doc || !view) {
    cleanup()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  // The receipt stays mounted until the browser is done printing, so the
  // preview never loses its source mid-spool. The long timer is only a fallback
  // for browsers that never fire afterprint.
  view.onafterprint = () => window.setTimeout(cleanup, 0)
  window.setTimeout(cleanup, 60_000)

  // One frame of layout so the preview does not snapshot a blank sheet.
  window.requestAnimationFrame(() => {
    view.focus()
    view.print()
  })
}
