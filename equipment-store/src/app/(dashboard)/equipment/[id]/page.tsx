import type { Metadata } from "next"
import { EquipmentRecordPage } from "@/components/pages/equipment-record"

export const metadata: Metadata = { title: "Equipment record" }

// Every tag carries one id, so there is nothing to enumerate at build time and
// the record is read from the store in the browser. A prefetched shell would
// only draw the dashboard layout before it knows which unit was scanned, so the
// route renders when the scan actually arrives.
export const instant = false

export default async function EquipmentRecordRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EquipmentRecordPage id={id} />
}
