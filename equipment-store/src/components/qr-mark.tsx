"use client"

import { QRCodeSVG } from "qrcode.react"

/**
 * The square on the tag. It is a real QR code — byte mode, error correction M,
 * four quiet modules — carrying the address of this equipment's record, so a
 * phone camera opens the item instead of reading a number the operator then has
 * to type. Drawn as SVG rather than dots so it stays sharp when the tag is
 * printed and so scanners get clean module edges.
 */
export function QrMark({ value, size = 104 }: { value: string; size?: number }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      marginSize={4}
      bgColor="#ffffff"
      fgColor="#0f172a"
      title={`Scan to open the record for ${value}`}
      className="block h-auto w-full max-w-[104px] shrink-0"
    />
  )
}
