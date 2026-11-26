import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateUserIncentiveSummary,
  type RawSaleRecord,
} from "../../src/services/incentive/incentive.calculator.js";
import { DEFAULT_INCENTIVE_RATE_PAISE } from "../../src/services/settings.cache.js";
import {
  updateIncentiveSettingsSchema,
  updateUserRateSchema,
} from "../../src/controller/incentive.validation.js";

test("Incentive Calculator Default Rate & Unpaid Fallback Unit Tests", async (t) => {
  await t.test("DEFAULT_INCENTIVE_RATE_PAISE defaults to 100 paise (₹1.00 per packet)", () => {
    assert.equal(DEFAULT_INCENTIVE_RATE_PAISE, 100);
  });

  await t.test(
    "calculateUserIncentiveSummary computes earned incentive with fallback ₹1.00 rate when legacy confirmed sales have null rate/amount",
    () => {
      const legacySales: RawSaleRecord[] = [
        {
          id: "sale-1",
          quantity: 1000,
          incentiveRatePaise: null,
          incentiveAmountPaise: null,
          confirmedAt: "2026-10-28T10:00:00Z",
          createdAt: "2026-10-28T10:00:00Z",
        },
        {
          id: "sale-2",
          quantity: 1100,
          incentiveRatePaise: null,
          incentiveAmountPaise: null,
          confirmedAt: "2026-10-29T10:00:00Z",
          createdAt: "2026-10-29T10:00:00Z",
        },
      ];

      const summary = calculateUserIncentiveSummary(
        "user-dual-role",
        legacySales,
        [],
        [],
        new Date("2026-11-26T00:00:00Z"),
        DEFAULT_INCENTIVE_RATE_PAISE
      );

      assert.equal(summary.totalConfirmedPackets, 2100);
      assert.equal(summary.salesIncentivePaise, 210000);
      assert.equal(summary.adjustedEntitlementPaise, 210000);
      assert.equal(summary.outstandingPaise, 210000);
      assert.equal(summary.previousMonth?.confirmedPackets, 2100);
      assert.equal(summary.previousMonth?.salesIncentivePaise, 210000);
      assert.equal(summary.previousMonth?.adjustedEntitlementPaise, 210000);
    }
  );

  await t.test(
    "calculateUserIncentiveSummary respects custom fallback rate for null-rate unpaid sales and preserves explicit locked sales",
    () => {
      const mixedSales: RawSaleRecord[] = [
        {
          id: "sale-locked",
          quantity: 500,
          incentiveRatePaise: 250,
          incentiveAmountPaise: 125000,
          confirmedAt: "2026-11-10T10:00:00Z",
          createdAt: "2026-11-10T10:00:00Z",
        },
        {
          id: "sale-legacy-null",
          quantity: 400,
          incentiveRatePaise: null,
          incentiveAmountPaise: null,
          confirmedAt: "2026-11-12T10:00:00Z",
          createdAt: "2026-11-12T10:00:00Z",
        },
      ];

      const summary = calculateUserIncentiveSummary(
        "user-2",
        mixedSales,
        [],
        [],
        new Date("2026-11-26T00:00:00Z"),
        200
      );

      // 500 * 250 = 125000, 400 * 200 = 80000 => 205000 paise
      assert.equal(summary.totalConfirmedPackets, 900);
      assert.equal(summary.salesIncentivePaise, 205000);
      assert.equal(summary.outstandingPaise, 205000);
    }
  );

  await t.test("validation schemas accept optional applyToUnpaid flag without breaking existing callers", () => {
    const withFlag = updateUserRateSchema.parse({
      ratePaise: 200,
      applyToUnpaid: true,
    });
    assert.equal(withFlag.ratePaise, 200);
    assert.equal(withFlag.applyToUnpaid, true);

    const withoutFlag = updateUserRateSchema.parse({
      ratePaise: 150,
    });
    assert.equal(withoutFlag.applyToUnpaid, undefined);

    const settingsWithFlag = updateIncentiveSettingsSchema.parse({
      incentiveRatePaise: 300,
      applyToUnpaid: true,
    });
    assert.equal(settingsWithFlag.incentiveRatePaise, 300);
    assert.equal(settingsWithFlag.applyToUnpaid, true);
  });
});
