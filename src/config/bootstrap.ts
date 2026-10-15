import "dotenv/config";
import bcrypt from "bcrypt";
import type { PrismaClient } from "../generated/prisma/client.js";

/**
 * Ensures a Super Admin account exists in the database.
 * - If no Super Admin exists (first time developer seed): creates the admin using
 *   ADMIN_EMAIL and ADMIN_PASSWORD from .env.
 * - If a Super Admin already exists: PRESERVES their password (so changes made in
 *   Admin Settings are never overwritten on server restart or re-seed).
 */
export async function bootstrapInitialAdmin(database: PrismaClient) {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";
  const adminName = process.env.ADMIN_NAME || "Super Admin";

  const existingAdmin = await database.user.findFirst({
    where: {
      OR: [
        { role: "SUPER_ADMIN" },
        { email: adminEmail },
      ],
    },
  });

  if (existingAdmin) {
    // Preserve existing password!
    // Only sync email if it changed in .env (e.g. .com -> .in) and ensure active status.
    const updateData: { email?: string; active?: boolean } = {};
    if (existingAdmin.email !== adminEmail) {
      updateData.email = adminEmail;
    }
    if (!existingAdmin.active) {
      updateData.active = true;
    }
    if (Object.keys(updateData).length > 0) {
      await database.user.update({
        where: { id: existingAdmin.id },
        data: updateData,
      });
      console.info(`[Bootstrap] Updated Super Admin email to ${adminEmail} (password preserved).`);
    }
    return existingAdmin;
  }

  // First time seed: create initial Super Admin
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await database.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
      active: true,
    },
  });
  console.info(`[Bootstrap] Initial Super Admin created with email: ${admin.email}`);
  return admin;
}
