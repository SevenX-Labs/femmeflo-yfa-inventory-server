import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { authUserSelect, toPublicUser } from "./auth.types.js";
import { HttpError } from "../../middleware/validation.js";
import { z } from "zod";

const issuer = "femmeflo-inventory-api";
const audience = "femmeflo-inventory-frontend";
const expiresInSeconds = { "15m": 900, "1h": 3600, "8h": 28_800, "1d": 86_400 } as const;
const dummyHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);

export class AuthenticationError extends Error {
  constructor() { super("Invalid credentials or inactive account"); }
}

export function createAuthService(
  database: PrismaClient,
  config: { secret: string; expiresIn: keyof typeof expiresInSeconds },
) {
  return {
    async login(login: string, password: string) {
      const normalizedLogin = login.includes("@") ? login.trim().toLowerCase() : login.trim();
      const user = await database.user.findFirst({
        where: normalizedLogin.includes("@") ? { email: normalizedLogin } : { phone: normalizedLogin },
        select: authUserSelect,
      });
      const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? await dummyHash);
      if (!user || !user.active || !passwordMatches || Buffer.byteLength(password, "utf8") > 72) {
        throw new AuthenticationError();
      }
      const token = jwt.sign(
        { version: user.tokenVersion }, config.secret,
        { algorithm: "HS256", issuer, audience, subject: user.id, expiresIn: expiresInSeconds[config.expiresIn] },
      );
      return { token, tokenType: "Bearer" as const, expiresInSeconds: expiresInSeconds[config.expiresIn], user: toPublicUser(user) };
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
      const user = await database.user.findUnique({ where: { id: payload.sub! }, select: authUserSelect });
      if (!user?.active || user.tokenVersion !== payload.version) return null;
      return toPublicUser(user);
    },

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
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
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 mins

        await database.passwordReset.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });

        await database.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });
      }

      const isDev = process.env.NODE_ENV !== "production";
      return {
        success: true,
        message: "If an account exists, a password reset request has been created.",
        ...(isDev && rawToken ? { debugToken: rawToken } : {}),
      };
    },

    async resetPassword(rawToken: string, newPassword: string) {
      if (Buffer.byteLength(newPassword, "utf8") > 72) {
        throw new HttpError(400, "Password exceeds maximum allowed length");
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

      const passwordHash = await bcrypt.hash(newPassword, 12);

      await database.$transaction([
        database.user.update({
          where: { id: resetRecord.userId },
          data: {
            passwordHash,
            tokenVersion: { increment: 1 },
          },
        }),
        database.passwordReset.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() },
        }),
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

