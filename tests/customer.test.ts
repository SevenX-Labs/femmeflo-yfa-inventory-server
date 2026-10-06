import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/config/database.js";
import { loadAuthEnvironment, loadEnvironment } from "../src/config/env.js";
import { createAuthRoutes } from "../src/routes/auth/auth.routes.js";
import { createAuthService } from "../src/services/auth/auth.service.js";
import { createUserRoutes } from "../src/routes/user.routes.js";

const env = loadEnvironment();
const authEnv = loadAuthEnvironment();

if (!authEnv) {
  throw new Error("TEST_DATABASE_URL and JWT_SECRET must be set to run customer tests.");
}

const database = createDatabase(authEnv.DATABASE_URL);
const auth = createAuthService(database, { secret: authEnv.JWT_SECRET, expiresIn: authEnv.JWT_EXPIRES_IN });
const app = createApp({ corsOrigins: env.CORS_ORIGINS, authRoutes: createAuthRoutes(auth), userRoutes: createUserRoutes(database, auth) });

async function request(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const headers: Record<string, string> = {};
    if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
    if (options.body) headers["Content-Type"] = "application/json";

    const response = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = (await response.json()) as { success: boolean; message: string; data: Record<string, unknown> };
    return { status: response.status, json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("Category and Customer Management Endpoints Flow", async (t) => {
  const timestamp = Date.now();
  
  // 1. Create Admin, Manager, Seller users
  const adminRes = await auth.login(process.env["ADMIN_EMAIL"] ?? "admin@femmeflo.com", process.env["ADMIN_PASSWORD"] ?? "AdminPassword123!");
  const adminToken = adminRes.token;

  // Create Manager with permissions
  const createMgr = await request("/admin/managers", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Customer Test Manager ${timestamp}`,
      phone: `+91987${String(timestamp).slice(-7)}`,
      email: `mgr_${timestamp}@test.com`,
      password: "TestPassword123!",
      state: "Maharashtra",
      district: "Thane",
      permissions: ["SELLER_READ", "SELLER_CREATE"],
    },
  });
  assert.equal(createMgr.status, 201);

  // Login Manager
  const mgrLogin = await auth.login(`mgr_${timestamp}@test.com`, "TestPassword123!");
  const managerToken = mgrLogin.token;

  // Create Seller under Manager
  const createSeller = await request("/manager/sellers", {
    method: "POST",
    token: managerToken,
    body: {
      name: `Customer Test Seller ${timestamp}`,
      phone: `+91986${String(timestamp).slice(-7)}`,
      email: `seller_${timestamp}@test.com`,
      password: "TestPassword123!",
      state: "Maharashtra",
      district: "Thane",
      village: "Diva",
    },
  });
  assert.equal(createSeller.status, 201);

  // Login Seller
  const sellerLogin = await auth.login(`seller_${timestamp}@test.com`, "TestPassword123!");
  const sellerToken = sellerLogin.token;

  // 2. Admin creates Category
  const categoryName = `Retail Store ${timestamp}`;
  const createCat = await request("/admin/categories", {
    method: "POST",
    token: adminToken,
    body: { name: categoryName },
  });
  assert.equal(createCat.status, 201);
  const categoryId = (createCat.json.data["category"] as { id: string }).id;

  // Duplicate category returns 409
  const dupCat = await request("/admin/categories", {
    method: "POST",
    token: adminToken,
    body: { name: categoryName },
  });
  assert.equal(dupCat.status, 409);

  // Authenticated user lists categories
  const listCat = await request("/categories", { token: sellerToken });
  assert.equal(listCat.status, 200);
  assert.ok(Array.isArray(listCat.json.data["items"]));

  // 3. Seller creates Customer
  const createCustomer = await request("/seller/customers", {
    method: "POST",
    token: sellerToken,
    body: {
      shopName: `Quality Supermarket ${timestamp}`,
      contactName: "Ramesh Kumar",
      phone: `+91985${String(timestamp).slice(-7)}`,
      categoryId,
      state: "Maharashtra",
      district: "Thane",
      village: "Diva",
    },
  });
  assert.equal(createCustomer.status, 201);
  const customerId = (createCustomer.json.data["customer"] as { id: string }).id;

  // Seller gets own customer
  const getCust = await request(`/seller/customers/${customerId}`, { token: sellerToken });
  assert.equal(getCust.status, 200);

  // Manager lists customers (sees seller's customer)
  const mgrCustList = await request("/manager/customers", { token: managerToken });
  assert.equal(mgrCustList.status, 200);
  assert.ok((mgrCustList.json.data["items"] as unknown[]).length >= 1);

  // Admin lists customers
  const adminCustList = await request("/admin/customers", { token: adminToken });
  assert.equal(adminCustList.status, 200);

  // Cleanup DB connections
  t.after(async () => {
    await database.$disconnect();
  });
});
