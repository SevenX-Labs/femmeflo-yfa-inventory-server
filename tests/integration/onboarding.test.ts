import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import pg from "pg";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { createApp } from "../../src/app.js";
import { createAuthRoutes } from "../../src/routes/auth/auth.routes.js";
import { createAuthService } from "../../src/services/auth/auth.service.js";
import { createUserRoutes } from "../../src/routes/user.routes.js";

if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to a development PostgreSQL direct/session connection before running integration tests");
const schema = `inventory_test_${randomUUID().replaceAll("-", "")}`;
const connection = new URL(process.env.TEST_DATABASE_URL);
connection.searchParams.set("options", `-c search_path=${schema}`);
const pool = new pg.Pool({ connectionString: connection.toString(), connectionTimeoutMillis: 5000, max: 3 });
const database = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
const password = "Integration password 123";
let server: Server | undefined;
let base: string;
let adminToken: string;
let managerToken: string;
let managerId: string;
let otherManagerId: string;
let sellerId: string;

type ApiBody = { success: boolean; message: string; data: { token: string; user: { id: string; role: string; managerId: string; passwordHash?: string }; items: { id: string }[]; pagination: { total: number } } };
async function request(path: string, method = "GET", body?: unknown, token = adminToken) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() as ApiBody };
}

before(async () => {
  await pool.query(`CREATE SCHEMA "${schema}"`);
  const migrations = new URL("../../prisma/migrations/", import.meta.url);
  const entries = (await readdir(migrations, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const sql = (await readFile(new URL(`${entry.name}/migration.sql`, migrations), "utf8")).replace('CREATE SCHEMA IF NOT EXISTS "public";', "");
    await pool.query(sql);
  }
  await database.user.create({ data: { name: "Integration Admin", email: "admin@example.com", passwordHash: await bcrypt.hash(password, 4), role: "SUPER_ADMIN" } });
  const auth = createAuthService(database, { secret: randomBytes(48).toString("base64url"), expiresIn: "1h" });
  const app = createApp({ corsOrigins: [], requestLogging: false, authRoutes: createAuthRoutes(auth), userRoutes: createUserRoutes(database, auth) });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const login = await request("/auth/login", "POST", { login: "admin@example.com", password }, "");
  assert.equal(login.status, 200);
  adminToken = login.body.data.token;
});

after(async () => {
  try {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await database.$disconnect();
    // The only dropped schema is the unique one this test generated above.
    if (!/^inventory_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe test schema");
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally { await pool.end(); }
});

test("migration enforces unique HQ, nonnegative balances and RLS on private tables", async () => {
  const hq = await database.stockLocation.create({ data: { type: "HQ", name: "HQ" } });
  await assert.rejects(database.stockLocation.create({ data: { type: "HQ", name: "Duplicate HQ" } }));
  await assert.rejects(database.stockLocation.update({ where: { id: hq.id }, data: { balance: -1 } }));
  const result = await pool.query("SELECT relrowsecurity FROM pg_class JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid WHERE nspname=$1 AND relname='User'", [schema]);
  assert.equal(result.rows[0].relrowsecurity, true);
});

test("Admin creates Managers and duplicate contacts return 409", async () => {
  const input = { name: "Manager One", email: "one@example.com", phone: "+919000000001", password, state: "Maharashtra", district: "Thane", permissions: ["SELLER_READ", "SELLER_CREATE"] };
  const created = await request("/admin/managers", "POST", input);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.user.passwordHash, undefined);
  managerId = created.body.data.user.id;
  assert.equal((await request("/admin/managers", "POST", input)).status, 409);
  const second = await request("/admin/managers", "POST", { ...input, name: "Manager Two", email: "two@example.com", phone: "+919000000002" });
  assert.equal(second.status, 201);
  otherManagerId = second.body.data.user.id;
  const login = await request("/auth/login", "POST", { login: input.phone, password }, "");
  assert.equal(login.status, 200);
  managerToken = login.body.data.token;
});

test("Manager creates an assigned Seller and stock account atomically", async () => {
  const created = await request("/manager/sellers", "POST", { name: "Seller One", phone: "+919000000003", password, village: "Diva" }, managerToken);
  assert.equal(created.status, 201);
  sellerId = created.body.data.user.id;
  assert.equal(created.body.data.user.managerId, managerId);
  const location = await database.stockLocation.findUnique({ where: { sellerId } });
  assert.equal(location?.balance, 0);
  assert.equal(location?.type, "SELLER");
  const bad = await request("/manager/sellers", "POST", { name: "Outside", phone: "+919000000004", password, state: "Gujarat" }, managerToken);
  assert.equal(bad.status, 403);
  assert.equal(await database.user.count({ where: { phone: "+919000000004" } }), 0);
});

test("Manager cannot read another Manager's Seller or override scope using filters", async () => {
  const created = await request("/admin/sellers", "POST", { name: "Other Seller", phone: "+919000000005", password, managerId: otherManagerId });
  assert.equal(created.status, 201);
  assert.equal((await request(`/manager/sellers/${created.body.data.user.id}`, "GET", undefined, managerToken)).status, 404);
  const own = await request("/manager/sellers", "GET", undefined, managerToken);
  assert.equal(own.body.data.pagination.total, 1);
  assert.equal(own.body.data.items[0]?.id, sellerId);
  const override = await request(`/manager/sellers?managerId=${otherManagerId}`, "GET", undefined, managerToken);
  assert.equal(override.body.data.pagination.total, 0);
});

test("permission changes take effect immediately and deactivation invalidates prior tokens", async () => {
  assert.equal((await request(`/admin/managers/${managerId}/permissions`, "PATCH", { permissions: [] })).status, 200);
  assert.equal((await request("/manager/sellers", "GET", undefined, managerToken)).status, 403);
  assert.equal((await request(`/admin/managers/${managerId}`, "PATCH", { active: false })).status, 200);
  assert.equal((await request("/auth/me", "GET", undefined, managerToken)).status, 401);
  assert.equal((await request(`/admin/managers/${managerId}`, "PATCH", { active: true })).status, 200);
  assert.equal((await request("/auth/me", "GET", undefined, managerToken)).status, 401);
});

test("tightening a Manager's territory cannot silently hide an existing Seller", async () => {
  const createdManager = await request("/admin/managers", "POST", { name: "Unrestricted Manager", phone: "+919000000006", password });
  assert.equal(createdManager.status, 201);
  const unrestrictedId = createdManager.body.data.user.id;
  const createdSeller = await request("/admin/sellers", "POST", { name: "Unlocated Seller", phone: "+919000000007", password, managerId: unrestrictedId });
  assert.equal(createdSeller.status, 201);
  const changed = await request(`/admin/managers/${unrestrictedId}`, "PATCH", { state: "Maharashtra" });
  assert.equal(changed.status, 409);
  assert.equal((await database.user.findUnique({ where: { id: unrestrictedId } }))?.state, null);
});

test("Manager employeeCode can be added via admin and edited, and field officers with different villages in manager district match successfully", async () => {
  // 1. Create manager with employeeCode and territory with headquarters village
  const mgrRes = await request("/admin/managers", "POST", {
    name: "Balaghat Manager",
    phone: "+919000000010",
    password,
    employeeCode: "MGR-BG-01",
    state: "Madhya Pradesh",
    district: "Balaghat",
    village: "Katangi",
    permissions: ["SELLER_READ", "SELLER_CREATE"],
  });
  assert.equal(mgrRes.status, 201);
  const mgrId = mgrRes.body.data.user.id;
  assert.equal((mgrRes.body.data.user as any).employeeCode, "MGR-BG-01");

  // Verify fetch returns employeeCode
  const getMgr = await request(`/admin/managers/${mgrId}`, "GET");
  assert.equal(getMgr.status, 200);
  assert.equal((getMgr.body.data.user as any).employeeCode, "MGR-BG-01");

  // 2. Edit manager employeeCode via admin PATCH
  const patchMgr = await request(`/admin/managers/${mgrId}`, "PATCH", {
    employeeCode: "MGR-BG-01-EDITED",
  });
  assert.equal(patchMgr.status, 200);
  assert.equal((patchMgr.body.data.user as any).employeeCode, "MGR-BG-01-EDITED");

  // 3. Add field officer in different village within Balaghat district (e.g. Waraseoni)
  const sellerRes = await request("/admin/sellers", "POST", {
    name: "Waraseoni Field Officer",
    phone: "+919000000011",
    password,
    managerId: mgrId,
    state: "Madhya Pradesh",
    district: "Balaghat",
    village: "Waraseoni",
    employeeCode: "FO-WAR-01",
  });
  assert.equal(sellerRes.status, 201);
  const foId = sellerRes.body.data.user.id;
  assert.equal((sellerRes.body.data.user as any).managerId, mgrId);
  assert.equal((sellerRes.body.data.user as any).village, "Waraseoni");
  assert.equal((sellerRes.body.data.user as any).district, "Balaghat");
  assert.equal((sellerRes.body.data.user as any).state, "Madhya Pradesh");

  // 4. Update field officer territory and employeeCode
  const patchSeller = await request(`/admin/sellers/${foId}`, "PATCH", {
    village: "Baihar",
    employeeCode: "FO-WAR-01-EDITED",
  });
  assert.equal(patchSeller.status, 200);
  assert.equal((patchSeller.body.data.user as any).village, "Baihar");
  assert.equal((patchSeller.body.data.user as any).employeeCode, "FO-WAR-01-EDITED");

  // 5. Seller with mismatched district returns 403
  const badSeller = await request("/admin/sellers", "POST", {
    name: "Seoni Field Officer",
    phone: "+919000000012",
    password,
    managerId: mgrId,
    state: "Madhya Pradesh",
    district: "Seoni",
    village: "Seoni",
  });
  assert.equal(badSeller.status, 403);
});
