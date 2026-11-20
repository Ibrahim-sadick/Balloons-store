import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center bg-white px-6 py-10 text-center", className)}>
      <p className="text-[11px] font-normal tracking-tight text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-[10px] leading-4 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
