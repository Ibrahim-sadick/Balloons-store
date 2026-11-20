import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Categories the store orders under. This is the only seed data the store
 * needs: locations, assets, checkouts and maintenance all start empty.
 */
const categories = [
  { name: "Balloon envelope", code: "ENV" },
  { name: "Basket", code: "BAS" },
  { name: "Burner", code: "BRN" },
  { name: "Fuel cylinder", code: "CYL" },
  { name: "Inflation fan", code: "FAN" },
  { name: "Instruments", code: "INS" },
  { name: "Radio", code: "RAD" },
  { name: "Ropes", code: "RPE" },
  { name: "Weights", code: "WGT" },
  { name: "Helium", code: "HEL" },
  { name: "Pump", code: "PMP" },
  { name: "Ribbon", code: "RBN" },
  { name: "Safety gear", code: "SFG" },
  { name: "Tools", code: "TLS" },
  { name: "Ground gear", code: "GND" },
]

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { code: category.code },
      create: category,
    })
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@balons.store").trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password || password.length < 8) {
    throw new Error("Set SEED_ADMIN_PASSWORD (8+ characters) in .env before seeding.")
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin ${email} already exists — left untouched.`)
  } else {
    await prisma.user.create({
      data: {
        name: (process.env.SEED_ADMIN_NAME ?? "Store Manager").trim(),
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN",
      },
    })
    console.log(`Created admin ${email}.`)
  }

  console.log(`Categories ready: ${categories.length}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
