import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  computeTargetProgress,
  calculateUserIncentiveSummary,
  getTargetPeriodKey,
} from "../../src/services/incentive/incentive.calculator.js";
import { buildTargetBonusReason } from "../../src/services/incentive/target-bonus.service.js";
import {
  updateUserTargetSchema,
  bulkUpdateUserTargetSchema,
} from "../../src/controller/incentive.validation.js";
import { updateUserSchema, createSellerSchema, createManagerSchema } from "../../src/controller/user.validation.js";

test("computeTargetProgress calculates MONTHLY packet progress, ₹ revenue, and bonus unlock in IST", () => {
  const refDate = new Date("2026-11-27T10:00:00.000Z"); // 27 Nov 2026 IST
  const sales = [
    // In Nov 2026 IST
    { quantity: 80, totalPaise: 120_000, confirmedAt: "2026-11-05T08:00:00.000Z" },
    { quantity: 40, totalPaise: 60_000, confirmedAt: "2026-11-27T12:00:00.000Z" },
    // Outside Nov 2026 IST (Oct 2026 IST)
    { quantity: 200, totalPaise: 300_000, confirmedAt: "2026-10-31T18:00:00.000Z" },
  ];

  const inProgress = computeTargetProgress(
    { salesTargetPackets: 150, salesTargetPeriod: "MONTHLY", targetBonusPaise: 50_000 },
    sales,
    refDate
  );

  assert.equal(inProgress.hasTarget, true);
  assert.equal(inProgress.period, "MONTHLY");
  assert.equal(inProgress.periodLabel, "Nov 2026");
  assert.equal(inProgress.completedPackets, 120);
  assert.equal(inProgress.remainingPackets, 30);
  assert.equal(inProgress.completedRevenuePaise, 180_000);
  assert.equal(inProgress.progressPercent, 80);
  assert.equal(inProgress.bonusPaise, 50_000);
  assert.equal(inProgress.earnedBonusPaise, 0);
  assert.equal(inProgress.isAchieved, false);

  const completed = computeTargetProgress(
    { salesTargetPackets: 120, salesTargetPeriod: "MONTHLY", targetBonusPaise: 50_000 },
    sales,
    refDate
  );
  assert.equal(completed.isAchieved, true);
  assert.equal(completed.remainingPackets, 0);
  assert.equal(completed.progressPercent, 100);
  assert.equal(completed.earnedBonusPaise, 50_000);
});

test("computeTargetProgress respects IST day boundaries for DAILY targets", () => {
  // Reference time: 2026-11-27 12:00 IST (06:30 UTC)
  const refDate = new Date("2026-11-27T06:30:00.000Z");
  const sales = [
    // 2026-11-26 19:00 UTC -> 2026-11-27 00:30 IST (counts for Nov 27 IST)
    { quantity: 15, totalPaise: 22_500, confirmedAt: "2026-11-26T19:00:00.000Z" },
    // 2026-11-27 18:10 UTC -> 2026-11-27 23:40 IST (counts for Nov 27 IST)
    { quantity: 20, totalPaise: 30_000, confirmedAt: "2026-11-27T18:10:00.000Z" },
    // 2026-11-27 18:40 UTC -> 2026-11-28 00:10 IST (next IST day — excluded!)
    { quantity: 50, totalPaise: 75_000, confirmedAt: "2026-11-27T18:40:00.000Z" },
  ];

  const progress = computeTargetProgress(
    { salesTargetPackets: 30, salesTargetPeriod: "DAILY", targetBonusPaise: 20_000 },
    sales,
    refDate
  );

  assert.equal(progress.period, "DAILY");
  assert.equal(progress.periodLabel, "27 Nov 2026");
  assert.equal(getTargetPeriodKey("DAILY", refDate), "2026-11-27");
  assert.equal(progress.completedPackets, 35);
  assert.equal(progress.remainingPackets, 0);
  assert.equal(progress.completedRevenuePaise, 52_500);
  assert.equal(progress.progressPercent, 100);
  assert.equal(progress.isAchieved, true);
  assert.equal(progress.earnedBonusPaise, 20_000);
});

test("computeTargetProgress summarizes period sales even when no target is assigned", () => {
  const refDate = new Date("2026-11-27T10:00:00.000Z");
  const progress = computeTargetProgress(
    { salesTargetPackets: null, salesTargetPeriod: "MONTHLY", targetBonusPaise: 50_000 },
    [{ quantity: 25, totalPaise: 37_500, confirmedAt: "2026-11-20T09:00:00.000Z" }],
    refDate
  );

  assert.equal(progress.hasTarget, false);
  assert.equal(progress.targetPackets, null);
  assert.equal(progress.completedPackets, 25);
  assert.equal(progress.completedRevenuePaise, 37_500);
  assert.equal(progress.bonusPaise, 0);
  assert.equal(progress.earnedBonusPaise, 0);
  assert.equal(progress.isAchieved, false);
});

test("target bonus adjustment reason integrates cleanly into calculateUserIncentiveSummary", () => {
  const refDate = new Date("2026-11-27T10:00:00.000Z");
  const reason = buildTargetBonusReason("MONTHLY", "Nov 2026");
  assert.equal(reason, "Target Bonus • Monthly (Nov 2026)");

  const summary = calculateUserIncentiveSummary(
    "u1",
    [{ id: "s1", quantity: 100, incentiveRatePaise: 200, incentiveAmountPaise: 20_000, confirmedAt: refDate, createdAt: refDate }],
    [{ id: "a1", type: "ADD", amountPaise: 50_000, reason, adjustmentDate: refDate, createdAt: refDate }],
    [],
    refDate,
    200
  );

  assert.equal(summary.salesIncentivePaise, 20_000);
  assert.equal(summary.additionsPaise, 50_000);
  assert.equal(summary.adjustedEntitlementPaise, 70_000);
  assert.equal(summary.outstandingPaise, 70_000);
});

test("target validation schemas accept DAILY/MONTHLY updates, clearing target, and dailyTarget compat", () => {
  const setTarget = updateUserTargetSchema.parse({
    salesTargetPackets: 250,
    salesTargetPeriod: "MONTHLY",
    targetBonusPaise: 75000,
  });
  assert.equal(setTarget.salesTargetPackets, 250);
  assert.equal(setTarget.salesTargetPeriod, "MONTHLY");
  assert.equal(setTarget.targetBonusPaise, 75000);

  const clearedTarget = updateUserTargetSchema.parse({
    salesTargetPackets: null,
    salesTargetPeriod: "DAILY",
    targetBonusPaise: null,
  });
  assert.equal(clearedTarget.salesTargetPackets, null);

  const updatedSeller = updateUserSchema.parse({
    dailyTarget: 35,
    salesTargetPackets: 300,
    salesTargetPeriod: "MONTHLY",
    targetBonusPaise: 50000,
  });
  assert.equal(updatedSeller.salesTargetPackets, 300);
  assert.equal(updatedSeller.dailyTarget, 35);
  assert.ok(createSellerSchema);
  assert.ok(createManagerSchema);
});

test("server startup ensures target/remittance DDL before bootstrapping admin user", () => {
  const serverSrc = fs.readFileSync(path.resolve(process.cwd(), "server.ts"), "utf8");
  const ddlIdx = serverSrc.indexOf("await ensureSaleRemittanceSchema(database)");
  const bootstrapIdx = serverSrc.indexOf("await bootstrapInitialAdmin(database)");
  assert.ok(ddlIdx !== -1 && bootstrapIdx !== -1);
  assert.ok(
    ddlIdx < bootstrapIdx,
    "ensureSaleRemittanceSchema must run before bootstrapInitialAdmin so new User columns exist before querying"
  );
});

test("bulkUpdateUserTargetSchema validates employee list, target, and route wiring", () => {
  const valid = bulkUpdateUserTargetSchema.safeParse({
    userIds: [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ],
    salesTargetPackets: 250,
    salesTargetPeriod: "MONTHLY",
    targetBonusPaise: 50_000,
  });
  assert.equal(valid.success, true);

  const emptyUsers = bulkUpdateUserTargetSchema.safeParse({
    userIds: [],
    salesTargetPackets: 100,
  });
  assert.equal(emptyUsers.success, false);

  const routesSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/routes/admin/incentive.routes.ts"),
    "utf8"
  );
  assert.ok(routesSrc.includes("/users/bulk-target"));
  const serviceSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/services/admin/incentive.service.ts"),
    "utf8"
  );
  assert.ok(serviceSrc.includes("bulkUpdateUserTargets:"));
});
