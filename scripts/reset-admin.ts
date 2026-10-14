import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL || "admin@femmeflo.com";
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || "AdminPassword123!";
  const name = process.env.ADMIN_NAME || "Super Admin";

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/reset-admin.ts [email] [password]");
    process.exit(1);
  }

  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await db.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        role: "SUPER_ADMIN",
        active: true,
        tokenVersion: { increment: 1 },
      },
      create: {
        name,
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        active: true,
      },
    });

    console.log("==========================================");
    console.log("Super Admin Account Ready:");
    console.log(`Email:    ${admin.email}`);
    console.log(`Password: ${password}`);
    console.log(`Role:     ${admin.role}`);
    console.log(`Active:   ${admin.active}`);
    console.log("==========================================");
  } catch (err) {
    console.error("Failed to set admin credentials:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
