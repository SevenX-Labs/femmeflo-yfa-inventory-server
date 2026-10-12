import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { createAuthService } from "../../src/services/auth/auth.service.js";
import { MockEmailProvider } from "../../src/services/notification/email.provider.js";
import { MockWhatsAppProvider } from "../../src/services/notification/whatsapp.provider.js";
import { createNotificationService } from "../../src/services/notification/notification.service.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

test("Forgot-Password and Reset-Password Flow Unit Tests", async (t) => {
  const emailProvider = new MockEmailProvider();
  const whatsappProvider = new MockWhatsAppProvider();

  const userRecord = {
    id: "user-uuid-1",
    name: "Vikram Sharma",
    email: "vikram@example.com",
    phone: "+919876543210",
    passwordHash: await bcrypt.hash("OldPassword123!", 4),
    active: true,
    tokenVersion: 1,
  };

  const passwordResets: any[] = [];

  const fakeDb = {
    user: {
      async findFirst({ where }: any) {
        if (where.email === userRecord.email || where.phone === userRecord.phone) {
          return { ...userRecord };
        }
        return null;
      },
      async update({ where, data }: any) {
        if (where.id === userRecord.id) {
          if (data.passwordHash) userRecord.passwordHash = data.passwordHash;
          if (data.tokenVersion?.increment) userRecord.tokenVersion++;
        }
        return { ...userRecord };
      },
    },
    passwordReset: {
      async create({ data }: any) {
        const item = { id: `reset-${Date.now()}-${Math.random()}`, ...data, usedAt: null, createdAt: new Date() };
        passwordResets.push(item);
        return item;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const item of passwordResets) {
          if (item.userId === where.userId && (where.usedAt === null ? item.usedAt === null : true)) {
            Object.assign(item, data);
            count++;
          }
        }
        return { count };
      },
      async update({ where, data }: any) {
        const item = passwordResets.find((r) => r.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
      async findFirst({ where }: any) {
        const now = new Date();
        return (
          passwordResets.find(
            (r) =>
              r.tokenHash === where.tokenHash &&
              r.usedAt === null &&
              (!where.expiresAt?.gt || r.expiresAt > now)
          ) || null
        );
      },
    },
    async $transaction(promises: any[]) {
      return Promise.all(promises);
    },
  } as unknown as PrismaClient;

  const notifService = createNotificationService(fakeDb, emailProvider, whatsappProvider);
  const auth = createAuthService(fakeDb, { secret: "very_long_test_secret_key_minimum_32_characters", expiresIn: "1h" }, notifService);

  t.beforeEach(() => {
    emailProvider.clear();
  });

  await t.test("Forgot-password request for existing user generates hashed token and dispatches email", async () => {
    // In development / test environment, debugToken is returned for non-production convenience
    const devRes = await auth.forgotPassword("vikram@example.com");
    assert.equal(devRes.success, true);
    assert.match(devRes.message, /instructions to reset your password have been sent/i);
    assert.ok((devRes as any).debugToken, "debugToken present in non-production for local/integration tests");

    // In production environment, debugToken must NEVER be returned
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const prodRes = await auth.forgotPassword("vikram@example.com");
    process.env.NODE_ENV = origEnv;
    assert.equal((prodRes as any).debugToken, undefined, "Must not leak raw debugToken in production");

    // Email should be dispatched
    const sentEmails = emailProvider.getSentEmails();
    assert.ok(sentEmails.length >= 1);
    assert.equal(sentEmails[0]?.to, "vikram@example.com");

    // DB should contain records with hashed token (not raw token)
    assert.equal(passwordResets.length, 2);
    // The latest record is active and not used
    const latest = passwordResets[1];
    assert.ok(latest);
    assert.equal(latest.tokenHash.length, 64); // SHA-256 is 64 hex characters
    assert.ok(latest.expiresAt > new Date());
    assert.equal(latest.usedAt, null);
    // The previous record was invalidated (usedAt set)
    assert.ok(passwordResets[0]?.usedAt !== null);
  });

  await t.test("Forgot-password request for non-existent user returns same generic response and sends no email", async () => {
    const res = await auth.forgotPassword("nonexistent@example.com");

    assert.equal(res.success, true);
    assert.match(res.message, /instructions to reset your password have been sent/i);

    // No email sent
    const sentEmails = emailProvider.getSentEmails();
    assert.equal(sentEmails.length, 0);
  });

  await t.test("Reset password with valid token updates password and revokes token", async () => {
    // Generate token and record
    const rawToken = "super_secret_raw_reset_token_32chars";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    passwordResets.push({
      id: "reset-valid-1",
      userId: userRecord.id,
      user: { ...userRecord },
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 mins future
      usedAt: null,
    });

    const oldTokenVersion = userRecord.tokenVersion;
    const res = await auth.resetPassword(rawToken, "BrandNewPassword123!");

    assert.equal(res.success, true);
    assert.match(res.message, /Password reset successfully/i);

    // Password changed and tokenVersion incremented
    const passwordMatch = await bcrypt.compare("BrandNewPassword123!", userRecord.passwordHash);
    assert.equal(passwordMatch, true);
    assert.ok(userRecord.tokenVersion > oldTokenVersion);

    // Token record marked as used
    const record = passwordResets.find((r) => r.id === "reset-valid-1");
    assert.ok(record.usedAt !== null);
  });

  await t.test("Reusing already-used token fails with 400", async () => {
    const rawToken = "already_used_token_string";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    passwordResets.push({
      id: "reset-used-1",
      userId: userRecord.id,
      user: { ...userRecord },
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      usedAt: new Date(), // Already used
    });

    await assert.rejects(
      async () => auth.resetPassword(rawToken, "AnotherPassword123!"),
      { status: 400, message: /Invalid, expired, or already used/i }
    );
  });

  await t.test("Reset with expired token fails with 400", async () => {
    const rawToken = "expired_token_string";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    passwordResets.push({
      id: "reset-expired-1",
      userId: userRecord.id,
      user: { ...userRecord },
      tokenHash,
      expiresAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins past
      usedAt: null,
    });

    await assert.rejects(
      async () => auth.resetPassword(rawToken, "AnotherPassword123!"),
      { status: 400, message: /Invalid, expired, or already used/i }
    );
  });

  await t.test("Reset with invalid / non-existent token fails with 400", async () => {
    await assert.rejects(
      async () => auth.resetPassword("completely_bogus_token", "AnotherPassword123!"),
      { status: 400, message: /Invalid, expired, or already used/i }
    );
  });
});
