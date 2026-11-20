import type { ReactNode } from "react"
import {
  ArrowUpRight,
  CircleCheck,
  Clock3,
  Shield,
  Wrench,
} from "lucide-react"
import type { Condition, EquipmentStatus, MaintenanceStatus, Role } from "@/lib/types"
import { cn } from "@/lib/utils"

function BadgeFrame({
  className,
  icon,
  label,
}: {
  className: string
  icon: ReactNode
  label: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-normal whitespace-nowrap",
        className,
      )}
    >
      {icon}
      {label}
    </span>
  )
}

const iconClass = "h-3 w-3 shrink-0"

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  if (status === "available") {
    return (
      <BadgeFrame
        className="border-emerald-200 bg-emerald-50 text-emerald-700"
        icon={<CircleCheck className={iconClass} strokeWidth={1.75} />}
        label="Available"
      />
    )
  }
  if (status === "checked_out") {
    return (
      <BadgeFrame
        className="border-amber-200 bg-amber-50 text-amber-700"
        icon={<ArrowUpRight className={iconClass} strokeWidth={1.75} />}
        label="Checked Out"
      />
    )
  }
  return (
    <BadgeFrame
      className="border-rose-200 bg-rose-50 text-rose-700"
      icon={<Wrench className={iconClass} strokeWidth={1.75} />}
      label="Maintenance"
    />
  )
}

export function DirectionBadge({ direction }: { direction: "IN" | "OUT" }) {
  if (direction === "IN") {
    return <span className="inline-flex h-5 items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-normal text-emerald-700">IN</span>
  }
  return <span className="inline-flex h-5 items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-normal text-amber-700">OUT</span>
}

export function ConditionBadge({ condition }: { condition: Condition | string }) {
  const tone =
    condition === "Fair"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : condition === "Poor" || condition === "Damaged"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700"
  return <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-normal", tone)}>{condition}</span>
}

export function CheckoutBadge({ overdue }: { overdue: boolean }) {
  if (overdue) {
    return (
      <BadgeFrame
        className="border-rose-200 bg-rose-50 text-rose-700"
        icon={<Clock3 className={iconClass} strokeWidth={1.75} />}
        label="Overdue"
      />
    )
  }
  return (
    <BadgeFrame
      className="border-amber-200 bg-amber-50 text-amber-700"
      icon={<ArrowUpRight className={iconClass} strokeWidth={1.75} />}
      label="Open"
    />
  )
}

export function ReturnedBadge() {
  return (
    <BadgeFrame
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
      icon={<CircleCheck className={iconClass} strokeWidth={1.75} />}
      label="Returned"
    />
  )
}

export function MaintenanceBadge({ status }: { status: MaintenanceStatus }) {
  if (status === "completed") {
    return (
      <BadgeFrame
        className="border-emerald-200 bg-emerald-50 text-emerald-700"
        icon={<CircleCheck className={iconClass} strokeWidth={1.75} />}
        label="Completed"
      />
    )
  }
  if (status === "in_progress") {
    return (
      <BadgeFrame
        className="border-rose-200 bg-rose-50 text-rose-700"
        icon={<Wrench className={iconClass} strokeWidth={1.75} />}
        label="In progress"
      />
    )
  }
  return (
    <BadgeFrame
      className="border-amber-200 bg-amber-50 text-amber-700"
      icon={<Clock3 className={iconClass} strokeWidth={1.75} />}
      label="Scheduled"
    />
  )
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <BadgeFrame
      className="border-slate-200 bg-slate-50 text-slate-700"
      icon={<Shield className={iconClass} strokeWidth={1.75} />}
      label={role === "STOREKEEPER" ? "Storekeeper" : role === "ADMIN" ? "Admin" : "Viewer"}
    />
  )
}
