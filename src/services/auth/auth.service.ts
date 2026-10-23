import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { authUserSelect, toPublicUser } from "./auth.types.js";
import { HttpError } from "../../middleware/validation.js";
import { z } from "zod";
import type { NotificationService } from "../notification/notification.service.js";

const issuer = "femmeflo-inventory-api";
const audience = "femmeflo-inventory-frontend";
const defaultExpiresInSeconds: Record<string, number> = {
  "15m": 900,
  "1h": 3600,
  "5h": 18_000,
  "8h": 28_800,
  "1d": 86_400,
  "7d": 604_800,
  "30d": 2_592_000,
};

export function parseExpiresInSeconds(val: string): number {
  if (val in defaultExpiresInSeconds && defaultExpiresInSeconds[val] !== undefined) {
    return defaultExpiresInSeconds[val]!;
  }
  const match = val.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) return 3600;
  const count = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "s") return count;
  if (unit === "m") return count * 60;
  if (unit === "h") return count * 3600;
  if (unit === "d") return count * 86400;
  return 3600;
}

const dummyHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);

export class AuthenticationError extends Error {
  constructor() { super("Invalid credentials or inactive account"); }
}

export function createAuthService(
  database: PrismaClient,
  config: { secret: string; expiresIn: string },
  notificationService?: NotificationService
) {
  const tokenDuration = parseExpiresInSeconds(config.expiresIn);
  const isStubDb = !("$transaction" in (database as any));
  const authCacheTtlMs = isStubDb || process.env.NODE_ENV === "test" ? 0 : 30_000;

  const userAuthCache = new Map<string, { user: ReturnType<typeof toPublicUser>; tokenVersion: number; expiresAt: number }>();

  return {
    invalidateUser(userId: string) {
      userAuthCache.delete(userId);
    },
    clearCache() {
      userAuthCache.clear();
    },

    async login(login: string, password: string) {
      const raw = login.trim();
      const isEmail = raw.includes("@");
      let whereClause: any;

      if (isStubDb) {
        whereClause = isEmail ? { email: raw.toLowerCase() } : { phone: raw };
      } else if (isEmail) {
        whereClause = { email: raw.toLowerCase() };
      } else {
        const cleanDigits = raw.replace(/\D/g, "");
        const candidates = new Set<string>([raw]);
        if (cleanDigits.length === 10) {
          candidates.add(`+91${cleanDigits}`);
          candidates.add(cleanDigits);
          candidates.add(`0${cleanDigits}`);
        } else if (cleanDigits.length === 12 && cleanDigits.startsWith("91")) {
          candidates.add(`+${cleanDigits}`);
          candidates.add(cleanDigits.slice(2));
          candidates.add(`0${cleanDigits.slice(2)}`);
        } else if (cleanDigits.length === 11 && cleanDigits.startsWith("0")) {
          candidates.add(`+91${cleanDigits.slice(1)}`);
          candidates.add(cleanDigits.slice(1));
          candidates.add(cleanDigits);
        }
        whereClause = {
          OR: [
            { phone: { in: Array.from(candidates) } },
            { email: raw.toLowerCase() },
          ],
        };
      }

      const user = await database.user.findFirst({
        where: whereClause,
        select: authUserSelect,
      });
      const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? await dummyHash);
      if (!user || !user.active || !passwordMatches || Buffer.byteLength(password, "utf8") > 72) {
        throw new AuthenticationError();
      }
      const token = jwt.sign(
        { version: user.tokenVersion }, config.secret,
        { algorithm: "HS256", issuer, audience, subject: user.id, expiresIn: tokenDuration },
      );
      return { token, tokenType: "Bearer" as const, expiresInSeconds: tokenDuration, user: toPublicUser(user) };
    },

    async authenticate(token: string) {
      let payload: jwt.JwtPayload;
      try {
        const verified = jwt.verify(token, config.secret, { algorithms: ["HS256"], issuer, audience });
        if (typeof verified === "string") return null;
        payload = verified;
      } catch {
        return null;
      }
      if (!z.uuid().safeParse(payload.sub).success || !Number.isInteger(payload.version) || typeof payload.exp !== "number") return null;

      const userId = payload.sub!;
      if (authCacheTtlMs > 0) {
        const cached = userAuthCache.get(userId);
        const now = Date.now();
        if (cached && cached.expiresAt > now && cached.tokenVersion === payload.version) {
          return cached.user;
        }
      }

      const user = await database.user.findUnique({ where: { id: userId }, select: authUserSelect });
      if (!user?.active || user.tokenVersion !== payload.version) {
        if (authCacheTtlMs > 0) userAuthCache.delete(userId);
        return null;
      }
      const publicUser = toPublicUser(user);
      if (authCacheTtlMs > 0) {
        userAuthCache.set(userId, { user: publicUser, tokenVersion: user.tokenVersion, expiresAt: Date.now() + authCacheTtlMs });
      }
      return publicUser;
    },

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
      userAuthCache.delete(userId);
      const user = await database.user.findUnique({ where: { id: userId }, select: authUserSelect });
      if (!user?.active || Buffer.byteLength(currentPassword, "utf8") > 72 || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        throw new HttpError(401, "Current password is incorrect");
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const changed = await database.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash, active: true, tokenVersion: user.tokenVersion },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      if (!changed.count) throw new HttpError(409, "Account changed. Log in again and retry");
    },

    async forgotPassword(login: string) {
      const normalizedLogin = login.includes("@") ? login.trim().toLowerCase() : login.trim();
      const user = await database.user.findFirst({
        where: normalizedLogin.includes("@") ? { email: normalizedLogin } : { phone: normalizedLogin },
      });

      let rawToken: string | undefined;

      if (user && user.active) {
        rawToken = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

        // Invalidate previous active reset tokens for this user
        await database.passwordReset.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });

        // Store hashed token only in database
        await database.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });

        // Send reset email via notification service if user has an email
        if (user.email && notificationService) {
          await notificationService.sendPasswordResetEmail(user.email, rawToken, user.name);
        }
      }

      // Return generic success message without leaking whether user exists
      const isTestOrDev = process.env.NODE_ENV !== "production";
      return {
        success: true,
        message: "If an account matches those details, instructions to reset your password have been sent.",
        ...(isTestOrDev && rawToken ? { debugToken: rawToken } : {}),
      };
    },

    async resetPassword(rawToken: string, newPassword: string) {
      if (Buffer.byteLength(newPassword, "utf8") > 72) {
        throw new HttpError(400, "Password exceeds maximum allowed length of 72 bytes");
      }
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      const resetRecord = await database.passwordReset.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!resetRecord || !resetRecord.user.active) {
        throw new HttpError(400, "Invalid, expired, or already used password reset token");
      }

      userAuthCache.delete(resetRecord.userId);
      const passwordHash = await bcrypt.hash(newPassword, 12);

      await database.$transaction([
        // Update password and increment tokenVersion to revoke active sessions
        database.user.update({
          where: { id: resetRecord.userId },
          data: {
            passwordHash,
            tokenVersion: { increment: 1 },
          },
        }),
        // Mark reset token as used immediately to prevent token reuse
        database.passwordReset.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() },
        }),
        // Invalidate any other active reset tokens for this user
        database.passwordReset.updateMany({
          where: { userId: resetRecord.userId, usedAt: null },
          data: { usedAt: new Date() },
        }),
      ]);

      return { success: true, message: "Password reset successfully. Please log in with your new password." };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
