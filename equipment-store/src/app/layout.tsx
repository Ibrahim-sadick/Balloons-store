import type { Metadata } from "next"
import { DM_Sans, Geist_Mono } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SignOutVeil } from "@/components/layout/sign-out-overlay"
import { StoreProvider } from "@/lib/store"
import "./globals.css"

const dmSans = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Balons Store",
    template: "%s · Balons Store",
  },
  description:
    "Equipment and asset storage for the Balons cage. Track what is on the hook, who has it, and when it is due back.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">
        <TooltipProvider delay={300}>
          <StoreProvider>{children}</StoreProvider>
        </TooltipProvider>
        {/* Outside the route tree on purpose: signing out changes the page, and
            the veil has to keep the screen past that change. */}
        <SignOutVeil />
      </body>
    </html>
  )
}
