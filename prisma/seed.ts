import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const database = createDatabase(databaseUrl);
  try {
    const adminName = process.env.ADMIN_NAME || "Super Admin";
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";

    await database.$transaction(async (tx) => {
      // Serialize simultaneous bootstrap attempts
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71230421)`;

      // Clean up any stray dummy data so DB is pristine
      await tx.delivery.deleteMany({});
      await tx.notification.deleteMany({});
      await tx.paymentRecord.deleteMany({});
      await tx.invoice.deleteMany({});
      await tx.stockMovement.deleteMany({});
      await tx.sale.deleteMany({});
      await tx.customer.deleteMany({});
      await tx.stockLocation.deleteMany({ where: { type: { not: "HQ" } } });
      await tx.user.deleteMany({ where: { role: { not: "SUPER_ADMIN" } } });

      const existingAdmin = await tx.user.findFirst({
        where: {
          OR: [
            { role: "SUPER_ADMIN" },
            { email: adminEmail },
          ],
        },
      });

      if (existingAdmin) {
        // PRESERVE existing password!
        await tx.user.update({
          where: { id: existingAdmin.id },
          data: {
            email: adminEmail,
            name: adminName,
            role: "SUPER_ADMIN",
            active: true,
          },
        });
        console.info(`Super Admin verified: ${adminEmail} (password preserved).`);
      } else {
        // Create initial Super Admin from .env credentials
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await tx.user.create({
          data: {
            name: adminName,
            email: adminEmail,
            passwordHash,
            role: "SUPER_ADMIN",
            active: true,
          },
        });
        console.info(`Initial Super Admin created: ${adminEmail}`);
      }

      await tx.businessSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
      const hq = await tx.stockLocation.findFirst({ where: { type: "HQ" } });
      if (!hq) {
        await tx.stockLocation.create({ data: { type: "HQ", name: "HQ Central Warehouse" } });
      }
    });

    console.info("Prisma seed finished: 0 dummy users, clean Super Admin ready.");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await database.$disconnect();
  }
}

main();
