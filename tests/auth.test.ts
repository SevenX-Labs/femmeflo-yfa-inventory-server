import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { PrismaClient, Prisma } from "../src/generated/prisma/client.js";
import type { AuthUser } from "../src/services/auth/auth.types.js";
import { createAuthService } from "../src/services/auth/auth.service.js";
import { createAuthRoutes } from "../src/routes/auth/auth.routes.js";
import { createUserRoutes } from "../src/routes/user.routes.js";
import { createApp } from "../src/app.js";
import { loadAuthEnvironment } from "../src/config/env.js";
import { createManagerSchema, managerCreateSellerSchema, permissionsSchema } from "../src/controller/user.validation.js";
import { passwordSchema } from "../src/middleware/validation.js";

const secret = randomBytes(48).toString("base64url");
const password = "Test account password 123";
const id = "ab987cbb-6eb7-45d8-8f04-8c13e0ac2aa6";
let user: AuthUser;
let hash: string;
let server: Server;
let baseUrl: string;

// Only persistence is stubbed. HTTP routing, validation, bcrypt and JWT are real.
const database = {
  user: {
    async findFirst({ where }: Prisma.UserFindFirstArgs) {
      return where?.email === user.email || where?.phone === user.phone ? { ...user } : null;
    },
    async findUnique({ where }: Prisma.UserFindUniqueArgs) {
      return where.id === user.id ? { ...user } : null;
    },
    async updateMany({ where, data }: Prisma.UserUpdateManyArgs) {
      if (where?.id !== user.id || where.passwordHash !== user.passwordHash || where.tokenVersion !== user.tokenVersion || !user.active) return { count: 0 };
      user.passwordHash = data.passwordHash as string;
      user.tokenVersion++;
      return { count: 1 };
    },
  },
} as unknown as PrismaClient;
const auth = createAuthService(database, { secret, expiresIn: "1h" });

before(async () => {
  hash = await bcrypt.hash(password, 4);
  const app = createApp({ corsOrigins: ["http://localhost:3000"], requestLogging: false,
    authRoutes: createAuthRoutes(auth), userRoutes: createUserRoutes(database, auth),
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
beforeEach(() => {
  user = { id, name: "Test Seller", email: "seller@example.com", phone: "+919876543210", passwordHash: hash,
    role: "SELLER", active: true, tokenVersion: 0, managerId: null, permissions: [], state: null, district: null, village: null, alternatePhone: null, designation: null, employeeCode: null, address: null, pincode: null, aadharNumber: null, drivingLicense: null, education: null };
});
after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function login(body: unknown) {
  return fetch(`${baseUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function token() { return (await auth.login(user.email!, password)).token; }

test("login accepts normalized email and phone and never returns the password hash", async () => {
  for (const loginValue of ["  SELLER@EXAMPLE.COM  ", user.phone]) {
    const response = await login({ login: loginValue, password });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { user: Record<string, unknown>; token: string; tokenType: string; expiresInSeconds: number } };
    assert.equal(body.data.user.id, id);
    assert.equal(body.data.tokenType, "Bearer");
    assert.equal(body.data.expiresInSeconds, 3600);
    assert.equal(body.data.user.passwordHash, undefined);
    assert.equal(body.data.user.tokenVersion, undefined);
    assert.equal((await auth.authenticate(body.data.token))?.id, id);
  }
});

test("missing fields and role injection return 400", async () => {
  assert.equal((await login({ login: user.email })).status, 400);
  assert.equal((await login({ login: user.email, password, role: "SUPER_ADMIN" })).status, 400);
});

test("wrong, unknown and inactive credentials return the same response", async () => {
  const wrong = await login({ login: user.email, password: "incorrect" });
  const unknown = await login({ login: "unknown@example.com", password });
  user.active = false;
  const inactive = await login({ login: user.email, password });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(inactive.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
  assert.deepEqual(await inactive.json(), { success: false, message: "Invalid credentials or inactive account" });
});

test("me requires a bearer token and returns the current user", async () => {
  assert.equal((await fetch(`${baseUrl}/auth/me`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: "Bearer invalid" } })).status, 401);
  const response = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${await token()}` } });
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { data: { user: { id: string } } }).data.user.id, id);
});

test("expired, wrong-signature, wrong-audience, missing-expiry and malformed-subject tokens are rejected", async () => {
  const options = { algorithm: "HS256" as const, subject: id, issuer: "femmeflo-inventory-api", audience: "femmeflo-inventory-frontend" };
  const invalid = [
    jwt.sign({ version: 0 }, secret, { ...options, expiresIn: -1 }),
    jwt.sign({ version: 0 }, "different-secret", { ...options, expiresIn: 60 }),
    jwt.sign({ version: 0 }, secret, { ...options, audience: "other-app", expiresIn: 60 }),
    jwt.sign({ version: 0 }, secret, options),
    jwt.sign({ version: 0 }, secret, { ...options, subject: "not-an-id", expiresIn: 60 }),
    jwt.sign({ version: 0 }, secret, { ...options, algorithm: "HS384", expiresIn: 60 }),
  ];
  for (const value of invalid) assert.equal(await auth.authenticate(value), null);
});

test("deactivation and token-version changes revoke existing tokens", async () => {
  const value = await token();
  user.active = false;
  assert.equal(await auth.authenticate(value), null);
  user.active = true;
  user.tokenVersion++;
  assert.equal(await auth.authenticate(value), null);
});

test("Seller cannot call Admin or Manager endpoints", async () => {
  const headers = { Authorization: `Bearer ${await token()}` };
  assert.equal((await fetch(`${baseUrl}/admin/managers`, { headers })).status, 403);
  assert.equal((await fetch(`${baseUrl}/manager/sellers`, { headers })).status, 403);
});

test("Manager needs a permission even with a valid token", async () => {
  user.role = "MANAGER";
  const headers = { Authorization: `Bearer ${await token()}` };
  assert.equal((await fetch(`${baseUrl}/manager/sellers`, { headers })).status, 403);
  assert.equal((await fetch(`${baseUrl}/admin/sellers`, { headers })).status, 403);
});

test("password change verifies the old password, hashes the new one and revokes old tokens", async () => {
  const value = await token();
  const headers = { Authorization: `Bearer ${value}`, "Content-Type": "application/json" };
  const bad = await fetch(`${baseUrl}/auth/password`, { method: "PATCH", headers, body: JSON.stringify({ currentPassword: "wrong", newPassword: "Replacement password 123" }) });
  assert.equal(bad.status, 401);
  const response = await fetch(`${baseUrl}/auth/password`, { method: "PATCH", headers, body: JSON.stringify({ currentPassword: password, newPassword: "Replacement password 123" }) });
  assert.equal(response.status, 200);
  assert.notEqual(user.passwordHash, "Replacement password 123");
  assert.equal(await bcrypt.compare("Replacement password 123", user.passwordHash), true);
  assert.equal(await auth.authenticate(value), null);
  await assert.rejects(auth.login(user.email!, password));
  assert.ok((await auth.login(user.email!, "Replacement password 123")).token);
});

test("password validation handles bcrypt's byte limit and onboarding rejects privilege fields", () => {
  assert.equal(passwordSchema.safeParse("short").success, false);
  assert.equal(passwordSchema.safeParse("🙂".repeat(19)).success, false);
  assert.equal(passwordSchema.safeParse("a".repeat(72)).success, true);
  const input = { name: "Seller", phone: "+919876543210", password };
  assert.equal(managerCreateSellerSchema.safeParse({ ...input, managerId: id }).success, false);
  assert.equal(createManagerSchema.safeParse({ ...input, role: "SUPER_ADMIN" }).success, false);
  assert.equal(permissionsSchema.safeParse({ permissions: ["SUPER_ADMIN"] }).success, false);
});

test("production auth cannot start with missing or weak configuration", () => {
  assert.throws(() => loadAuthEnvironment({ NODE_ENV: "production" }), /configuration/);
  assert.throws(() => loadAuthEnvironment({ DATABASE_URL: "https://invalid.example", JWT_SECRET: "weak" }), /configuration/);
  assert.equal(loadAuthEnvironment({ NODE_ENV: "development" }), undefined);
});

test("authentication attempts are rate limited with a JSON 429 response", async () => {
  let response: Response | undefined;
  for (let index = 0; index < 21; index++) response = await login({});
  assert.equal(response!.status, 429);
  assert.equal((await response!.json() as { success: boolean }).success, false);
  assert.ok(response!.headers.get("retry-after"));
});
