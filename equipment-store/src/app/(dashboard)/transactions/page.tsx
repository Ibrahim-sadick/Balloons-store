import type { Metadata } from "next"
import { TransactionsPage } from "@/components/pages/transactions-page"

export const metadata: Metadata = { title: "Check In & Check Out" }

export default function Page() {
  return <TransactionsPage />
}
