import { Suspense } from "react"
import type { Metadata } from "next"
import { MaintenancePage } from "@/components/pages/maintenance-page"

export const metadata: Metadata = { title: "Maintenance" }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MaintenancePage />
    </Suspense>
  )
}
