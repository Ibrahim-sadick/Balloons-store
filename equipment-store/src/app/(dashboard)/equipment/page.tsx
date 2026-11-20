import { Suspense } from "react"
import type { Metadata } from "next"
import { EquipmentPage } from "@/components/pages/equipment-page"

export const metadata: Metadata = { title: "Equipment" }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EquipmentPage />
    </Suspense>
  )
}
