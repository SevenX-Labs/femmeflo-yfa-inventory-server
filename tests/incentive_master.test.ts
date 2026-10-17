import { cleanupTestData } from "./test_cleanup.js";
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
  throw new Error("TEST_DATABASE_URL and JWT_SECRET must be set to run master incentive tests.");
}

const database = createDatabase(authEnv.DATABASE_URL);
const auth = createAuthService(database, { secret: authEnv.JWT_SECRET, expiresIn: authEnv.JWT_EXPIRES_IN });
const app = createApp({
  corsOrigins: env.CORS_ORIGINS,
  authRoutes: createAuthRoutes(auth),
  userRoutes: createUserRoutes(database, auth),
});

async function request(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const headers: Record<string, string> = {};
    if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
    if (options.body) headers["Content-Type"] = "application/json";

    const reqInit: RequestInit = {
      method: options.method ?? "GET",
      headers,
    };
    if (options.body) {
      reqInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      ...reqInit,
    });
    const json = (await response.json()) as { success: boolean; message: string; data: Record<string, any> };
    return { status: response.status, json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("Complete Master Incentive System Workflow (All 18 Scenarios)", async (t) => {
  const rand = Math.floor(Math.random() * 8999999 + 1000000);
  const timestamp = `${Date.now()}_${rand}`;

  // Login as Super Admin
  const adminEmail = process.env["ADMIN_EMAIL"] ?? "admin@femmeflo.in";
  const adminPassword = process.env["ADMIN_PASSWORD"] ?? "femmeflo@2026";
  const adminLogin = await auth.login(adminEmail, adminPassword);
  const adminToken = adminLogin.token;

  // Set global fallback incentive rate to ₹1.00 (100 paise)
  await request("/admin/incentives/settings", {
    method: "PATCH",
    token: adminToken,
    body: { incentiveRatePaise: 100 },
  });

  // Create Category for testing
  const catRes = await request("/admin/categories", {
    method: "POST",
    token: adminToken,
    body: { name: `Master Category ${timestamp}` },
  });
  assert.equal(catRes.status, 201);
  const categoryId = catRes.json.data["category"].id;

  // Create Manager
  const mgrRes = await request("/admin/managers", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Master Manager ${timestamp}`,
      phone: `+9171${rand}`,
      email: `mgr_${timestamp}@test.com`,
      password: "TestPassword123!",
      permissions: ["SELLER_READ", "SELLER_CREATE"],
    },
  });
  assert.equal(mgrRes.status, 201);
  const managerId = mgrRes.json.data["user"].id;
  const mgrLogin = await auth.login(`mgr_${timestamp}@test.com`, "TestPassword123!");
  const managerToken = mgrLogin.token;

  // Create Seller A under Manager
  const sARes = await request("/manager/sellers", {
    method: "POST",
    token: managerToken,
    body: {
      name: `Seller A ${timestamp}`,
      phone: `+9172${rand}`,
      email: `sellerA_${timestamp}@test.com`,
      password: "TestPassword123!",
    },
  });
  assert.equal(sARes.status, 201);
  const sellerAId = sARes.json.data["user"].id;
  const sALogin = await auth.login(`sellerA_${timestamp}@test.com`, "TestPassword123!");
  const sellerAToken = sALogin.token;

  // Create Seller B under Manager
  const sBRes = await request("/manager/sellers", {
    method: "POST",
    token: managerToken,
    body: {
      name: `Seller B ${timestamp}`,
      phone: `+9173${rand}`,
      email: `sellerB_${timestamp}@test.com`,
      password: "TestPassword123!",
    },
  });
  assert.equal(sBRes.status, 201);
  const sellerBId = sBRes.json.data["user"].id;
  const sBLogin = await auth.login(`sellerB_${timestamp}@test.com`, "TestPassword123!");
  const sellerBToken = sBLogin.token;

  // Create customer for Seller A
  const custResA = await request("/seller/customers", {
    method: "POST",
    token: sellerAToken,
    body: {
      shopName: `Shop A ${timestamp}`,
      contactName: "Ramesh Store",
      phone: `+9174${rand}`,
      categoryId,
      state: "Maharashtra",
      district: "Mumbai",
      village: "Andheri",
    },
  });
  assert.equal(custResA.status, 201);
  const customerAId = custResA.json.data["customer"].id;

  // Create customer for Seller B
  const custResB = await request("/seller/customers", {
    method: "POST",
    token: sellerBToken,
    body: {
      shopName: `Shop B ${timestamp}`,
      contactName: "Suresh Store",
      phone: `+9175${rand}`,
      categoryId,
      state: "Maharashtra",
      district: "Mumbai",
      village: "Bandra",
    },
  });
  assert.equal(custResB.status, 201);
  const customerBId = custResB.json.data["customer"].id;

  // Add stock to HQ and transfer to Seller A and Seller B
  const hqReceipt = await request("/admin/inventory/receipts", {
    method: "POST",
    token: adminToken,
    body: { quantity: 1000 },
  });
  assert.equal(hqReceipt.status, 201);
  const hqId = hqReceipt.json.data["hq"].id;

  const invA = await request("/seller/inventory", { token: sellerAToken });
  const locAId = invA.json.data["locationId"] as string;
  await request("/admin/inventory/transfers", {
    method: "POST",
    token: adminToken,
    body: { sourceId: hqId, destinationId: locAId, quantity: 200 },
  });

  const invB = await request("/seller/inventory", { token: sellerBToken });
  const locBId = invB.json.data["locationId"] as string;
  await request("/admin/inventory/transfers", {
    method: "POST",
    token: adminToken,
    body: { sourceId: hqId, destinationId: locBId, quantity: 200 },
  });

  // ==========================================
  // SCENARIO 2: Different Sellers have different incentive rates
  // Admin sets Seller A to ₹0.50 (50 paise), Seller B to ₹1.25 (125 paise)
  // ==========================================
  const setRateA = await request(`/admin/incentives/users/${sellerAId}/rate`, {
    method: "PATCH",
    token: adminToken,
    body: { ratePaise: 50, reason: "Special Tier 1 rate" },
  });
  assert.equal(setRateA.status, 200);
  assert.equal(setRateA.json.data.user.incentiveRatePaise, 50);

  const setRateB = await request(`/admin/incentives/users/${sellerBId}/rate`, {
    method: "PATCH",
    token: adminToken,
    body: { ratePaise: 125, reason: "High Performance Tier" },
  });
  assert.equal(setRateB.status, 200);
  assert.equal(setRateB.json.data.user.incentiveRatePaise, 125);

  // ==========================================
  // SCENARIO 1: Seller earns incentives from eligible confirmed sales
  // Seller A sells 100 packets @ ₹25 -> 100 * ₹0.50 = ₹50.00 (5000 paise)
  // Seller B sells 40 packets @ ₹25 -> 40 * ₹1.25 = ₹50.00 (5000 paise)
  // ==========================================
  const saleARes = await request("/seller/sales", {
    method: "POST",
    token: sellerAToken,
    body: { customerId: customerAId, quantity: 100, unitPricePaise: 2500, paymentMode: "CASH" },
  });
  assert.equal(saleARes.status, 201);
  assert.equal(saleARes.json.data.sale.incentiveRatePaise, 50);
  assert.equal(saleARes.json.data.sale.incentiveAmountPaise, 5000);

  const saleBRes = await request("/seller/sales", {
    method: "POST",
    token: sellerBToken,
    body: { customerId: customerBId, quantity: 40, unitPricePaise: 2500, paymentMode: "CASH" },
  });
  assert.equal(saleBRes.status, 201);
  assert.equal(saleBRes.json.data.sale.incentiveRatePaise, 125);
  assert.equal(saleBRes.json.data.sale.incentiveAmountPaise, 5000);

  // Check Seller A view
  const sellerAView = await request("/seller/incentives", { token: sellerAToken });
  assert.equal(sellerAView.status, 200);
  assert.equal(sellerAView.json.data.summary.totalPacketsSold, 100);
  assert.equal(sellerAView.json.data.summary.totalIncentivePaise, 5000);
  assert.equal(sellerAView.json.data.summary.totalIncentiveRupees, 50);
  assert.equal(sellerAView.json.data.summary.outstandingPaise, 5000);
  assert.equal(sellerAView.json.data.summary.status, "UNPAID");

  // ==========================================
  // SCENARIO 3: Admin changes rate without rewriting finalized historical earnings
  // Admin changes Seller A rate to ₹2.00 (200 paise). Historical sale remains at ₹0.50!
  // ==========================================
  await request(`/admin/incentives/users/${sellerAId}/rate`, {
    method: "PATCH",
    token: adminToken,
    body: { ratePaise: 200, reason: "Mid-month promotion" },
  });

  const sellerAViewPostRateChange = await request("/seller/incentives", { token: sellerAToken });
  assert.equal(sellerAViewPostRateChange.json.data.summary.totalIncentivePaise, 5000); // Historical unchanged!
  assert.equal(sellerAViewPostRateChange.json.data.items[0].incentiveRatePaise, 50);

  // New sale for Seller A at ₹2.00: 10 packets * ₹2.00 = ₹20.00 (2000 paise)
  const saleA2 = await request("/seller/sales", {
    method: "POST",
    token: sellerAToken,
    body: { customerId: customerAId, quantity: 10, unitPricePaise: 2500, paymentMode: "CASH" },
  });
  assert.equal(saleA2.status, 201);
  assert.equal(saleA2.json.data.sale.incentiveRatePaise, 200);
  assert.equal(saleA2.json.data.sale.incentiveAmountPaise, 2000);

  // Now Seller A total earned: 5000 + 2000 = 7000 paise (₹70.00)
  const sellerAUpdated = await request("/seller/incentives", { token: sellerAToken });
  assert.equal(sellerAUpdated.json.data.summary.totalIncentivePaise, 7000);
  assert.equal(sellerAUpdated.json.data.summary.outstandingPaise, 7000);

  // ==========================================
  // SCENARIO 4: Admin adds an incentive adjustment (+₹10.00 / 1000 paise)
  // Entitlement becomes 7000 + 1000 = 8000 paise (₹80.00)
  // ==========================================
  const addAdj = await request(`/admin/incentives/users/${sellerAId}/adjustments`, {
    method: "POST",
    token: adminToken,
    body: { type: "ADD", amountPaise: 1000, reason: "Festival bonus" },
  });
  assert.equal(addAdj.status, 201);

  const sellerAPostAdd = await request("/seller/incentives", { token: sellerAToken });
  assert.equal(sellerAPostAdd.json.data.summary.additionsPaise, 1000);
  assert.equal(sellerAPostAdd.json.data.summary.adjustedEntitlementPaise, 8000);
  assert.equal(sellerAPostAdd.json.data.summary.outstandingPaise, 8000);

  // ==========================================
  // SCENARIO 5: Admin deducts an incentive adjustment (-₹5.00 / 500 paise)
  // Entitlement becomes 8000 - 500 = 7500 paise (₹75.00)
  // ==========================================
  const deductAdj = await request(`/admin/incentives/users/${sellerAId}/adjustments`, {
    method: "POST",
    token: adminToken,
    body: { type: "DEDUCT", amountPaise: 500, reason: "Late reporting penalty" },
  });
  assert.equal(deductAdj.status, 201);

  const sellerAPostDeduct = await request("/seller/incentives", { token: sellerAToken });
  assert.equal(sellerAPostDeduct.json.data.summary.deductionsPaise, 500);
  assert.equal(sellerAPostDeduct.json.data.summary.adjustedEntitlementPaise, 7500);
  assert.equal(sellerAPostDeduct.json.data.summary.outstandingPaise, 7500);

  // ==========================================
  // SCENARIO 6: Admin makes a partial payment (Payment 1: ₹30.00 / 3000 paise)
  // Paid: 3000, Remaining: 4500, Status: PARTIALLY_PAID
  // ==========================================
  const pay1 = await request(`/admin/incentives/users/${sellerAId}/payouts`, {
    method: "POST",
    token: adminToken,
    body: {
      amountPaise: 3000,
      paymentMethod: "BANK",
      referenceId: "TXN1001",
      remarks: "First tranche",
    },
  });
  assert.equal(pay1.status, 201);

  const sellerAPostPay1 = await request("/seller/incentives", { token: sellerAToken });
  assert.equal(sellerAPostPay1.json.data.summary.totalPaidPaise, 3000);
  assert.equal(sellerAPostPay1.json.data.summary.outstandingPaise, 4500);
  assert.equal(sellerAPostPay1.json.data.summary.status, "PARTIALLY_PAID");

  // ==========================================
  // SCENARIO 7: Admin makes a second partial payment (Payment 2: ₹25.00 / 2500 paise)
  // Paid: 5500, Remaining: 2000, Status: PARTIALLY_PAID
  // ==========================================
  const pay2 = await request(`/admin/incentives/users/${sellerAId}/payouts`, {
    method: "POST",
    token: adminToken,
    body: {
      amountPaise: 2500,
      paymentMethod: "UPI",
      referenceId: "TXN1002",
      remarks: "Second tranche",
    },
  });
  assert.equal(pay2.status, 201);

  const sellerAPostPay2 = await request("/seller/incentives", { token: sellerAToken });
  assert.equal(sellerAPostPay2.json.data.summary.totalPaidPaise, 5500);
  assert.equal(sellerAPostPay2.json.data.summary.outstandingPaise, 2000);
  assert.equal(sellerAPostPay2.json.data.summary.status, "PARTIALLY_PAID");

  // ==========================================
  // SCENARIO 9: Overpayment is rejected
  // Remaining is ₹20.00 (2000 paise). Attempting to pay ₹25.00 (2500 paise) must be rejected with 400!
  // ==========================================
  const overpay = await request(`/admin/incentives/users/${sellerAId}/payouts`, {
    method: "POST",
    token: adminToken,
    body: {
      amountPaise: 2500,
      paymentMethod: "BANK",
    },
  });
  assert.equal(overpay.status, 400);

  // ==========================================
  // SCENARIO 10: Duplicate payment submission does not create duplicate records (Idempotency)
  // Submit with requestKey: same key submitted twice executes once
  // ==========================================
  const idempotencyKey = `req_${timestamp}_settle`;
  const pay3 = await request(`/admin/incentives/users/${sellerAId}/payouts`, {
    method: "POST",
    token: adminToken,
    body: {
      amountPaise: 2000,
      paymentMethod: "BANK",
      referenceId: "TXN1003",
      requestKey: idempotencyKey,
      remarks: "Final settlement",
    },
  });
  assert.equal(pay3.status, 201);

  // Duplicate submission with same requestKey
  const pay3Dup = await request(`/admin/incentives/users/${sellerAId}/payouts`, {
    method: "POST",
    token: adminToken,
    body: {
      amountPaise: 2000,
      paymentMethod: "BANK",
      referenceId: "TXN1003",
      requestKey: idempotencyKey,
      remarks: "Final settlement retry",
    },
  });
  assert.ok(pay3Dup.status === 200 || pay3Dup.status === 201); // Idempotent return without duplicate!
  assert.equal(pay3Dup.json.data.payout.id, pay3.json.data.payout.id);

  // ==========================================
  // SCENARIO 8: Full settlement changes the outstanding balance to zero
  // Total paid = 7500, outstanding = 0, status = PAID
  // ==========================================
  const sellerAPostPay3 = await request("/seller/incentives", { token: sellerAToken });
  assert.equal(sellerAPostPay3.json.data.summary.totalPaidPaise, 7500);
  assert.equal(sellerAPostPay3.json.data.summary.outstandingPaise, 0);
  assert.equal(sellerAPostPay3.json.data.summary.status, "PAID");

  // Attempting another payout on fully settled balance fails
  const settledPay = await request(`/admin/incentives/users/${sellerAId}/payouts`, {
    method: "POST",
    token: adminToken,
    body: { amountPaise: 500, paymentMethod: "CASH" },
  });
  assert.equal(settledPay.status, 400);

  // ==========================================
  // SCENARIO 11: Seller cannot record a payout or change their rate
  // ==========================================
  const sellerEditRate = await request(`/admin/incentives/users/${sellerAId}/rate`, {
    method: "PATCH",
    token: sellerAToken,
    body: { ratePaise: 500 },
  });
  assert.equal(sellerEditRate.status, 403);

  const sellerPayout = await request(`/admin/incentives/users/${sellerAId}/payouts`, {
    method: "POST",
    token: sellerAToken,
    body: { amountPaise: 100 },
  });
  assert.equal(sellerPayout.status, 403);

  // ==========================================
  // SCENARIO 12: Manager cannot mark a team member's incentive as paid
  // ==========================================
  const mgrPayout = await request(`/admin/incentives/users/${sellerAId}/payouts`, {
    method: "POST",
    token: managerToken,
    body: { amountPaise: 100 },
  });
  assert.equal(mgrPayout.status, 403);

  const mgrEditRate = await request(`/admin/incentives/users/${sellerAId}/rate`, {
    method: "PATCH",
    token: managerToken,
    body: { ratePaise: 300 },
  });
  assert.equal(mgrEditRate.status, 403);

  // ==========================================
  // SCENARIO 13 & 14: Manager can view personal earnings and team earnings separately
  // Manager personal earnings are NOT double counted in team totals
  // ==========================================
  const mgrIncRes = await request("/manager/incentives", { token: managerToken });
  assert.equal(mgrIncRes.status, 200);
  assert.ok(mgrIncRes.json.data.personal);
  assert.ok(mgrIncRes.json.data.team);

  // Team summary checks: Seller A (settled ₹75) + Seller B (earned ₹50, unpaid)
  assert.equal(mgrIncRes.json.data.team.summary.assignedSellersCount, 2);
  assert.equal(mgrIncRes.json.data.team.summary.totalPacketsSold, 150); // 110 + 40
  assert.equal(mgrIncRes.json.data.team.summary.totalPaidPaise, 7500);
  assert.equal(mgrIncRes.json.data.team.summary.totalPendingPaise, 5000); // Seller B pending

  // Personal earnings of manager currently 0 (no personal sales yet)
  assert.equal(mgrIncRes.json.data.personal.summary.totalPacketsSold, 0);
  assert.equal(mgrIncRes.json.data.personal.summary.totalIncentivePaise, 0);

  // Now Manager also earns personal incentive as a Seller:
  // Transfer 100 packets to Manager
  const mgrReceipt = await database.stockLocation.create({
    data: {
      type: "SELLER",
      name: `Mgr Loc ${timestamp}`,
      sellerId: managerId,
      balance: 100,
    },
  });

  const custResMgr = await request("/seller/customers", {
    method: "POST",
    token: managerToken,
    body: {
      shopName: `Mgr Shop ${timestamp}`,
      contactName: "Manager Store",
      phone: `+9179${rand}`,
      categoryId,
      state: "Maharashtra",
      district: "Mumbai",
      village: "Dadar",
    },
  });
  assert.equal(custResMgr.status, 201);
  const customerMgrId = custResMgr.json.data["customer"].id;

  const saleMgr = await request("/seller/sales", {
    method: "POST",
    token: managerToken,
    body: { customerId: customerMgrId, quantity: 20, unitPricePaise: 2500, paymentMode: "CASH" },
  });
  assert.equal(saleMgr.status, 201);

  // Manager checks /manager/incentives again:
  // Personal earnings must be 20 pkts * ₹1.00 = 2000 paise (₹20.00)
  // Team earnings MUST NOT include the Manager's personal 2000 paise!
  const mgrIncUpdated = await request("/manager/incentives", { token: managerToken });
  assert.equal(mgrIncUpdated.json.data.personal.summary.totalPacketsSold, 20);
  assert.equal(mgrIncUpdated.json.data.personal.summary.totalIncentivePaise, 2000);
  assert.equal(mgrIncUpdated.json.data.team.summary.totalPacketsSold, 150); // Unchanged!
  assert.equal(mgrIncUpdated.json.data.team.summary.totalPendingPaise, 5000); // Unchanged!

  // ==========================================
  // SCENARIO 15, 16, 17: Reports, Allocations, and Audit History
  // ==========================================
  const detailsA = await request(`/admin/incentives/users/${sellerAId}`, { token: adminToken });
  assert.equal(detailsA.status, 200);
  assert.equal(detailsA.json.data.rateHistory.length, 2); // 2 rate changes recorded in history
  assert.equal(detailsA.json.data.adjustments.length, 2); // 1 add, 1 deduct
  assert.equal(detailsA.json.data.payouts.length, 3); // 3 payouts recorded
  assert.ok(detailsA.json.data.payouts[0].allocations.length > 0); // Allocations recorded

  // Admin company overview report
  const adminOverview = await request("/admin/incentives", { token: adminToken });
  assert.equal(adminOverview.status, 200);
  assert.ok(adminOverview.json.data.summary.totalEarnedPaise > 0);
  assert.ok(adminOverview.json.data.summary.totalPaidPaise > 0);

  t.after(async () => {
    await cleanupTestData(database);
    await database.$disconnect();
  });
});
