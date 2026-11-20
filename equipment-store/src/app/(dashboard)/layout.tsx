import { Suspense, type ReactNode } from "react"
import { Shell } from "@/components/layout/shell"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Shell>{children}</Shell>
    </Suspense>
  )
}
