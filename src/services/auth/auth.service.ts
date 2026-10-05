import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
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
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
