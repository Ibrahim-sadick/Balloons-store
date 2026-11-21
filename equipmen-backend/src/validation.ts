import { z } from "zod"
import { badRequest } from "./errors"

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-20.")

/** Today on this server's clock, in the same YYYY-MM-DD form the store uses. */
function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Days that have already happened. Everything the store records — a date
 * acquired, a repair opened or closed, a return — lands on or before today;
 * only an expected return date is allowed to sit in the future.
 */
const pastOrToday = (message: string) => dateOnly.refine((value) => value <= todayIso(), message)

const quantity = z
  .number({ invalid_type_error: "Enter how many. Use a whole number such as 5, 10, or 50." })
  .int("Enter a whole number such as 5, 10, or 50.")
  .min(1, "Enter at least one.")

const condition = z.enum(["New", "Excellent", "Good", "Fair", "Poor", "Damaged"])
const role = z.enum(["ADMIN", "STOREKEEPER", "VIEWER"])

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
})

export const createEquipmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80, "Keep the name under 80 characters."),
  categoryId: z.string().trim().optional(),
  categoryName: z.string().trim().max(60).optional(),
  locationId: z.string().trim().optional(),
  locationName: z.string().trim().max(60).optional(),
  locationZone: z.string().trim().max(60).optional(),
  serialNumber: z.string().trim().max(60).optional(),
  manufacturer: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  condition: condition.default("Good"),
  acquiredOn: pastOrToday("The acquired date cannot be later than today."),
  notes: z.string().trim().max(500).optional(),
  quantity,
})

export const updateEquipmentSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(80).optional(),
    categoryId: z.string().trim().optional(),
    locationId: z.string().trim().optional(),
    serialNumber: z.string().trim().max(60).optional(),
    manufacturer: z.string().trim().max(80).optional(),
    model: z.string().trim().max(80).optional(),
    condition: condition.optional(),
    acquiredOn: pastOrToday("The acquired date cannot be later than today.").optional(),
    notes: z.string().trim().max(500).optional(),
    quantity: quantity.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nothing to update.")

const importRowSchema = z.object({
  line: z.number().int().min(1),
  name: z.string().trim(),
  quantity: z.string().trim(),
  serialNumber: z.string().trim(),
  categoryName: z.string().trim(),
  locationName: z.string().trim(),
  manufacturer: z.string().trim(),
  model: z.string().trim(),
  condition: z.string().trim(),
  acquiredOn: z.string().trim(),
  notes: z.string().trim(),
})

export const importSchema = z.object({
  rows: z
    .array(importRowSchema)
    .min(1, "That CSV has no equipment rows.")
    .max(500, "Import at most 500 rows at a time."),
})

export const createCheckoutSchema = z.object({
  equipmentId: z.string().min(1, "Choose an asset from the register."),
  quantity,
  issuedTo: z.string().trim().min(1, "Choose who is taking the item.").max(80),
  expectedReturn: dateOnly,
  conditionOut: condition,
  notes: z.string().trim().max(300).optional(),
})

export const createReturnSchema = z.object({
  quantity,
  returnedOn: pastOrToday("The return date cannot be later than today."),
  returnedBy: z.string().trim().min(1, "Enter who is returning the equipment.").max(80),
  conditionIn: condition,
  notes: z.string().trim().max(300).optional(),
})

export const createMaintenanceSchema = z.object({
  equipmentId: z.string().min(1, "Choose an asset from the register."),
  type: z.enum(["Inspection", "Calibration", "Repair", "Service", "Gas refill"]),
  status: z.enum(["scheduled", "in_progress", "completed"]).default("in_progress"),
  technician: z.string().trim().min(1, "Enter who is doing the work.").max(80),
  openedOn: pastOrToday("The opened date cannot be later than today."),
  notes: z.string().trim().max(300).optional(),
  quantity,
})

export const completeMaintenanceSchema = z.object({
  completedOn: pastOrToday("The completed date cannot be later than today."),
  notes: z.string().trim().max(300).optional(),
})

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(60),
  code: z
    .string()
    .trim()
    .max(6)
    .regex(/^[A-Za-z]*$/, "Use letters only for the code.")
    .optional(),
})

export const locationSchema = z.object({
  name: z.string().trim().min(1, "Enter a location name.").max(60),
  zone: z.string().trim().max(60).optional(),
  code: z
    .string()
    .trim()
    .max(6)
    .regex(/^[A-Za-z]*$/, "Use letters only for the code.")
    .optional(),
})

export const roleSchema = z.object({ role })

/** Turns a zod failure into the single message the UI shows above the form. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? "Check the details and try again.")
  }
  return result.data as z.output<S>
}

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>
export type CreateReturnInput = z.infer<typeof createReturnSchema>
export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>
export type ImportRow = z.infer<typeof importRowSchema>
