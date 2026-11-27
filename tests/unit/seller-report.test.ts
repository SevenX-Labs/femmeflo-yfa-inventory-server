import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sellerReportQuerySchema } from "../../src/controller/report.validation.js";
import { buildSellerReportPayload } from "../../src/services/seller/report.service.js";
import type { TargetProgressSummary } from "../../src/services/incentive/incentive.calculator.js";

const SAMPLE_TARGET_PROGRESS: TargetProgressSummary = {
  hasTarget: true,
  period: "MONTHLY",
  periodLabel: "Nov 2026",
  targetPackets: 100,
  completedPackets: 60,
  remainingPackets: 40,
  completedRevenuePaise: 90_000,
  progressPercent: 60,
  bonusPaise: 50_000,
  earnedBonusPaise: 0,
  isAchieved: false,
};

test("sellerReportQuerySchema validates date/datetime ranges and rejects extra keys", () => {
  const valid = sellerReportQuerySchema.safeParse({
    from: "2026-11-21",
    to: "2026-11-22",
  });
  assert.equal(valid.success, true);

  const empty = sellerReportQuerySchema.safeParse({});
  assert.equal(empty.success, true);

  const invalid = sellerReportQuerySchema.safeParse({
    from: "2026-11-21",
    extraParam: "not-allowed",
  });
  assert.equal(invalid.success, false);
});

test("buildSellerReportPayload aggregates overall metrics, incentive, and IST daily records", () => {
  // Reference "now": 2026-11-27 15:30 IST == 2026-11-27T10:00:00.000Z
  const now = new Date("2026-11-27T10:00:00.000Z");

  const shifts = [
    {
      id: "shift_day2",
      // 2026-11-27 00:30 IST -> 2026-11-26T19:00:00Z (must bucket under 2026-11-27 IST!)
      startTime: new Date("2026-11-26T19:00:00.000Z"),
      endTime: null,
      startLatitude: 19.2183,
      startLongitude: 72.9781,
      endLatitude: null,
      endLongitude: null,
      startAddress: "Thane",
      endAddress: null,
      totalDistanceKm: 0,
      status: "ACTIVE",
      visits: [
        {
          id: "visit_2a",
          shopName: "Laxmi Medical",
          latitude: 19.2403,
          longitude: 72.9901,
          checkInTime: new Date("2026-11-27T04:00:00.000Z"),
          checkOutTime: new Date("2026-11-27T04:30:00.000Z"),
          durationMins: 30,
          saleDone: true,
          saleId: "sale_2a",
          notes: "Restocked pads",
          customer: { id: "cust_1", shopName: "Laxmi Medical", phone: "9876543210" },
          sale: { id: "sale_2a", totalPaise: 30_000, quantity: 20, paymentMode: "CASH", status: "CONFIRMED" },
        },
      ],
    },
    {
      id: "shift_day1",
      startTime: new Date("2026-11-26T04:00:00.000Z"), // 09:30 IST on Nov 26
      endTime: new Date("2026-11-26T08:00:00.000Z"), // 4 hours
      startLatitude: 19.2,
      startLongitude: 72.95,
      endLatitude: 19.21,
      endLongitude: 72.96,
      startAddress: "Thane",
      endAddress: "Mulund",
      totalDistanceKm: 18.4,
      status: "COMPLETED",
      visits: [
        {
          id: "visit_1a",
          shopName: "Laxmi Medical", // same unique shop across days
          latitude: 19.205,
          longitude: 72.955,
          checkInTime: new Date("2026-11-26T05:00:00.000Z"),
          checkOutTime: new Date("2026-11-26T05:20:00.000Z"),
          durationMins: 20,
          saleDone: true,
          saleId: "sale_1a",
          notes: null,
          customer: { id: "cust_1", shopName: "Laxmi Medical", phone: "9876543210" },
          sale: { id: "sale_1a", totalPaise: 45_000, quantity: 30, paymentMode: "BANK", status: "COMPLETED" },
        },
        {
          id: "visit_1b",
          shopName: "Asha Store",
          latitude: 19.208,
          longitude: 72.958,
          checkInTime: new Date("2026-11-26T06:00:00.000Z"),
          checkOutTime: new Date("2026-11-26T06:15:00.000Z"),
          durationMins: 15,
          saleDone: false,
          saleId: null,
          notes: "Follow up Monday",
          customer: { id: "cust_2", shopName: "Asha Store", phone: "9876500000" },
          sale: null,
        },
      ],
    },
  ];

  const periodSales = [
    {
      id: "sale_2a",
      quantity: 20,
      unitPricePaise: 1500,
      totalPaise: 30_000,
      paymentMode: "CASH",
      status: "CONFIRMED",
      incentiveRatePaise: 200,
      incentiveAmountPaise: 4_000,
      confirmedAt: new Date("2026-11-27T04:20:00.000Z"),
      createdAt: new Date("2026-11-27T04:15:00.000Z"),
      customer: { id: "cust_1", shopName: "Laxmi Medical", contactName: "Ramesh", village: "Thane" },
    },
    {
      id: "sale_2b_pending",
      quantity: 10,
      unitPricePaise: 1100,
      totalPaise: 11_000,
      paymentMode: "PENDING",
      status: "PENDING_APPROVAL",
      incentiveRatePaise: null,
      incentiveAmountPaise: null,
      confirmedAt: null,
      createdAt: new Date("2026-11-27T05:00:00.000Z"),
      customer: { id: "cust_2", shopName: "Asha Store", contactName: "Meena", village: "Mulund" },
    },
    {
      id: "sale_1a",
      quantity: 30,
      unitPricePaise: 1500,
      totalPaise: 45_000,
      paymentMode: "BANK",
      status: "COMPLETED",
      incentiveRatePaise: 200,
      incentiveAmountPaise: 6_000,
      confirmedAt: new Date("2026-11-26T05:15:00.000Z"),
      createdAt: new Date("2026-11-26T05:10:00.000Z"),
      customer: { id: "cust_1", shopName: "Laxmi Medical", contactName: "Ramesh", village: "Thane" },
    },
  ];

  const allConfirmedSales = [
    {
      id: "sale_old",
      quantity: 50,
      incentiveRatePaise: 200,
      incentiveAmountPaise: 10_000,
      confirmedAt: new Date("2026-11-10T06:00:00.000Z"),
      createdAt: new Date("2026-11-10T06:00:00.000Z"),
    },
    ...periodSales.filter((s) => s.status !== "PENDING_APPROVAL"),
  ];

  const allAdjustments = [
    {
      id: "adj_in_range",
      type: "ADD" as const,
      amountPaise: 5_000,
      reason: "Weekend Push Bonus",
      adjustmentDate: new Date("2026-11-27T07:00:00.000Z"),
      createdAt: new Date("2026-11-27T07:00:00.000Z"),
    },
    {
      id: "adj_out_range",
      type: "ADD" as const,
      amountPaise: 25_000,
      reason: "Earlier Month Bonus",
      adjustmentDate: new Date("2026-11-10T07:00:00.000Z"),
      createdAt: new Date("2026-11-10T07:00:00.000Z"),
    },
  ];

  const payouts = [
    {
      id: "payout_1",
      amountPaise: 15_000,
      paymentDate: new Date("2026-11-15T06:00:00.000Z"),
      paymentMethod: "BANK",
      referenceId: "UTR123",
      remarks: "Mid month settlement",
      createdAt: new Date("2026-11-15T06:00:00.000Z"),
      allocations: [{ periodYear: 2026, periodMonth: 11, amountPaise: 15_000 }],
    },
  ];

  const report = buildSellerReportPayload({
    sellerId: "seller_1",
    from: "2026-11-26",
    to: "2026-11-27",
    now,
    effectiveRatePaise: 200,
    shifts,
    periodSales,
    allConfirmedSales,
    allAdjustments,
    payouts,
    targetProgress: SAMPLE_TARGET_PROGRESS,
  });

  // Overall period assertions
  assert.equal(report.summary.activeDays, 2);
  assert.equal(report.summary.shiftsCount, 2);
  assert.equal(report.summary.activeShiftsCount, 1);
  assert.equal(report.summary.completedShiftsCount, 1);
  assert.equal(report.summary.shopsVisited, 3);
  assert.equal(report.summary.uniqueShopsVisited, 2);
  assert.equal(report.summary.salesDoneVisits, 2);
  assert.equal(report.summary.conversionRatePercent, 67);
  assert.ok(report.summary.totalDistanceKm > 18.4); // 18.4 km + computed active shift distance
  assert.equal(report.summary.confirmedOrdersCount, 2);
  assert.equal(report.summary.pendingOrdersCount, 1);
  assert.equal(report.summary.totalPacketsSold, 50); // 20 + 30 (excludes pending)
  assert.equal(report.summary.totalSalesPaise, 75_000);
  assert.equal(report.summary.cashPaise, 30_000);
  assert.equal(report.summary.bankPaise, 45_000);
  assert.equal(report.summary.pendingPaise, 0);
  assert.equal(report.summary.baseCommissionPaise, 10_000);
  assert.equal(report.summary.additionsPaise, 5_000); // Only in-range bonus counted in period
  assert.equal(report.summary.netIncentivePaise, 15_000);

  // Lifetime incentive overview includes older sales & older bonus minus payouts
  // Sales: 10_000 + 4_000 + 6_000 = 20_000; Additions: 5_000 + 25_000 = 30_000; Earned: 50_000; Paid: 15_000
  assert.equal(report.incentiveOverview.salesIncentivePaise, 20_000);
  assert.equal(report.incentiveOverview.totalEarnedPaise, 50_000);
  assert.equal(report.incentiveOverview.totalPaidPaise, 15_000);
  assert.equal(report.incentiveOverview.outstandingPaise, 35_000);
  assert.equal(report.targetProgress?.targetPackets, 100);

  // Daily records newest-first in IST
  assert.equal(report.dailyRecords.length, 2);
  assert.equal(report.dailyRecords[0]?.date, "2026-11-27");
  assert.equal(report.dailyRecords[0]?.shopsVisited, 1);
  assert.equal(report.dailyRecords[0]?.netIncentivePaise, 9_000); // 4_000 base + 5_000 bonus
  assert.equal(report.dailyRecords[0]?.ordersCount, 2);
  assert.equal(report.dailyRecords[1]?.date, "2026-11-26");
  assert.equal(report.dailyRecords[1]?.shopsVisited, 2);
  assert.equal(report.dailyRecords[1]?.travelKm, 18.4);
  assert.equal(report.dailyRecords[1]?.netIncentivePaise, 6_000);
});

test("user.routes.ts mounts GET /seller/reports for SELLER and MANAGER portal roles", () => {
  const routesSource = fs.readFileSync(
    path.join(process.cwd(), "src/routes/user.routes.ts"),
    "utf-8"
  );
  assert.match(
    routesSource,
    /router\.use\(\s*["']\/seller\/reports["']\s*,\s*authenticate\s*,\s*requireRole\(\s*["']SELLER["']\s*,\s*["']MANAGER["']\s*\)\s*,\s*createSellerReportRoutes\(database\)\s*\)/
  );
});
