import "dotenv/config";
import bcrypt from "bcrypt";
import { z } from "zod";
import { createDatabase } from "../src/config/database.js";
import { emailSchema, passwordSchema } from "../src/middleware/validation.js";

const input = z.object({
  DATABASE_URL: z.string().min(1),
  ADMIN_NAME: z.string().trim().min(1),
  ADMIN_EMAIL: emailSchema,
  ADMIN_PASSWORD: passwordSchema,
}).safeParse(process.env);

if (!input.success) {
  console.error("Set DATABASE_URL, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in your local environment.");
  process.exitCode = 1;
} else {
  const database = createDatabase(input.data.DATABASE_URL);
  try {
    const passwordHash = await bcrypt.hash(input.data.ADMIN_PASSWORD, 12);
    await database.$transaction(async (tx) => {
      // Serialize simultaneous bootstrap attempts without changing existing accounts.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71230421)`;
      const existing = await tx.user.count({ where: { role: "SUPER_ADMIN" } });
      if (existing) throw new Error("A Super Admin already exists. Bootstrap will not create another.");
      await tx.user.create({ data: {
        name: input.data.ADMIN_NAME,
        email: input.data.ADMIN_EMAIL,
        passwordHash,
        role: "SUPER_ADMIN",
      } });
      await tx.businessSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
      const hq = await tx.stockLocation.findFirst({ where: { type: "HQ" } });
      if (!hq) await tx.stockLocation.create({ data: { type: "HQ", name: "HQ" } });
    });
    console.info("Initial Super Admin account created.");
  } catch {
    console.error("Bootstrap failed. Check the migration, database connection, and whether the Admin already exists.");
    process.exitCode = 1;
  } finally {
    await database.$disconnect();
  }
}
