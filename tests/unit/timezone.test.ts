import test from "node:test";
import assert from "node:assert/strict";
import {
  getISTDateComponents,
  istToUtcDate,
  getISTPeriodDateRange,
  parseISTDateRange,
  formatISTDate,
  IST_OFFSET_MS,
} from "../../src/utils/timezone.utils.js";

test("Asia/Kolkata (IST) Timezone Unit Tests", async (t) => {
  await t.test("IST offset constant is 5.5 hours (19,800,000 ms)", () => {
    assert.equal(IST_OFFSET_MS, 5.5 * 60 * 60 * 1000);
  });

  await t.test("UTC to IST date components conversion is accurate", () => {
    // 2026-10-12 18:30:00 UTC = 2026-10-13 00:00:00 IST
    const utcDate = new Date("2026-10-12T18:30:00.000Z");
    const components = getISTDateComponents(utcDate);
    assert.equal(components.year, 2026);
    assert.equal(components.month, 9); // Oct (0-indexed: 9)
    assert.equal(components.day, 13);
    assert.equal(components.hours, 0);
    assert.equal(components.minutes, 0);
    assert.equal(components.seconds, 0);
  });

  await t.test("00:00:00 IST maps to 18:30:00 UTC of previous day", () => {
    const utc = istToUtcDate(2026, 9, 1, 0, 0, 0, 0); // 1st October 2026 00:00 IST
    assert.equal(utc.toISOString(), "2026-09-30T18:30:00.000Z");
  });

  await t.test("Half-open month boundaries [gte, lt) for 'this_month'", () => {
    // Reference date: Oct 15th, 2026
    const refDate = new Date("2026-10-15T12:00:00.000Z");
    const range = getISTPeriodDateRange("this_month", refDate);

    assert.ok(range?.gte);
    assert.ok(range?.lt);
    // 1st Oct 2026 00:00:00 IST -> 30 Sep 2026 18:30:00 UTC
    assert.equal(range.gte.toISOString(), "2026-09-30T18:30:00.000Z");
    // 1st Nov 2026 00:00:00 IST -> 31 Oct 2026 18:30:00 UTC
    assert.equal(range.lt.toISOString(), "2026-10-31T18:30:00.000Z");
  });

  await t.test("Half-open month boundaries [gte, lt) for 'last_month'", () => {
    // Reference date: Oct 15th, 2026
    const refDate = new Date("2026-10-15T12:00:00.000Z");
    const range = getISTPeriodDateRange("last_month", refDate);

    assert.ok(range?.gte);
    assert.ok(range?.lt);
    // 1st Sep 2026 00:00:00 IST -> 31 Aug 2026 18:30:00 UTC
    assert.equal(range.gte.toISOString(), "2026-08-31T18:30:00.000Z");
    // 1st Oct 2026 00:00:00 IST -> 30 Sep 2026 18:30:00 UTC
    assert.equal(range.lt.toISOString(), "2026-09-30T18:30:00.000Z");
  });

  await t.test("Year crossover boundary: December to January", () => {
    // Reference date: Jan 5th, 2027
    const refDate = new Date("2027-01-05T12:00:00.000Z");
    const lastMonth = getISTPeriodDateRange("last_month", refDate);

    assert.ok(lastMonth?.gte);
    assert.ok(lastMonth?.lt);
    // 1st Dec 2026 00:00:00 IST -> 30 Nov 2026 18:30:00 UTC
    assert.equal(lastMonth.gte.toISOString(), "2026-11-30T18:30:00.000Z");
    // 1st Jan 2027 00:00:00 IST -> 31 Dec 2026 18:30:00 UTC
    assert.equal(lastMonth.lt.toISOString(), "2026-12-31T18:30:00.000Z");
  });

  await t.test("February and Leap Year boundary handling", () => {
    // 2024 is leap year (Feb has 29 days)
    const refDate2024 = new Date("2024-03-05T12:00:00.000Z");
    const feb2024 = getISTPeriodDateRange("last_month", refDate2024);
    assert.equal(feb2024?.gte?.toISOString(), "2024-01-31T18:30:00.000Z");
    assert.equal(feb2024?.lt?.toISOString(), "2024-02-29T18:30:00.000Z");

    // 2025 is not leap year (Feb has 28 days)
    const refDate2025 = new Date("2025-03-05T12:00:00.000Z");
    const feb2025 = getISTPeriodDateRange("last_month", refDate2025);
    assert.equal(feb2025?.gte?.toISOString(), "2025-01-31T18:30:00.000Z");
    assert.equal(feb2025?.lt?.toISOString(), "2025-02-28T18:30:00.000Z");
  });

  await t.test("parseISTDateRange parses YYYY-MM-DD into half-open interval", () => {
    const range = parseISTDateRange("2026-10-01", "2026-10-10");
    assert.ok(range?.gte);
    assert.ok(range?.lt);
    // Start of 1st Oct in IST
    assert.equal(range.gte.toISOString(), "2026-09-30T18:30:00.000Z");
    // Start of 11th Oct in IST (covers through end of 10th Oct)
    assert.equal(range.lt.toISOString(), "2026-10-10T18:30:00.000Z");
  });

  await t.test("formatISTDate produces human-readable string in Asia/Kolkata", () => {
    const date = new Date("2026-10-12T18:30:00.000Z");
    assert.equal(formatISTDate(date), "2026-10-13 00:00:00");
  });
});
