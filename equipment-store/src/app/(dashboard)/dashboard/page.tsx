import type { Metadata } from "next"
import { DashboardPage } from "@/components/pages/dashboard-page"

export const metadata: Metadata = { title: "Dashboard" }

export default function Page() {
  return <DashboardPage />
}
