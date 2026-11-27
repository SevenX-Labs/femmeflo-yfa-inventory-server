import test from "node:test";
import assert from "node:assert/strict";
import { listShiftsQuerySchema } from "../../src/controller/shift.validation.js";
import { createShiftService } from "../../src/services/shift.service.js";

test("Shift Filtering & Summary Aggregation Unit Tests", async (t) => {
  await t.test("listShiftsQuerySchema accepts date ranges, ACTIVE/COMPLETED status, and pageSize up to 500", () => {
    const parsed = listShiftsQuerySchema.parse({
      page: "1",
      pageSize: "200",
      from: "2026-05-27T00:00:00.000+05:30",
      to: "2026-11-27T23:59:59.999+05:30",
      status: "COMPLETED",
    });

    assert.equal(parsed.pageSize, 200);
    assert.equal(parsed.status, "COMPLETED");
    assert.equal(parsed.from?.toISOString(), "2026-05-26T18:30:00.000Z");
    assert.equal(parsed.to?.toISOString(), "2026-11-27T18:29:59.999Z");
  });

  await t.test("listSellerShifts computes accurate KPI summary across full filtered range even beyond pageSize", async () => {
    let capturedWhere: any = null;
    const mockDb: any = {
      shift: {
        count: async ({ where }: any) => {
          capturedWhere = where;
          return 3;
        },
        findMany: async ({ select }: any) => {
          // Summary lightweight query
          if (select) {
            return [
              {
                status: "COMPLETED",
                startTime: new Date("2026-11-27T04:00:00Z"),
                endTime: new Date("2026-11-27T06:00:00Z"), // 7200s
                totalDistanceKm: 12.4,
                _count: { visits: 4 },
              },
              {
                status: "COMPLETED",
                startTime: new Date("2026-11-26T04:00:00Z"),
                endTime: new Date("2026-11-26T05:30:00Z"), // 5400s
                totalDistanceKm: 8.1,
                _count: { visits: 3 },
              },
              {
                status: "ACTIVE",
                startTime: new Date(Date.now() - 1800 * 1000), // ~1800s active
                endTime: null,
                totalDistanceKm: 2.0,
                _count: { visits: 1 },
              },
            ];
          }
          // Paginated list query
          return [
            {
              id: "shift-1",
              sellerId: "seller-1",
              status: "COMPLETED",
              startTime: new Date("2026-11-27T04:00:00Z"),
              endTime: new Date("2026-11-27T06:00:00Z"),
              totalDistanceKm: 12.4,
              visits: [
                { checkInTime: new Date("2026-11-27T04:15:00Z"), checkOutTime: new Date("2026-11-27T04:30:00Z"), durationMins: 15 },
              ],
            },
          ];
        },
      },
    };

    const service = createShiftService(mockDb);
    const from = new Date("2026-11-25T18:30:00.000Z");
    const to = new Date("2026-11-27T18:29:59.999Z");
    const result = await service.listSellerShifts("seller-1", {
      page: 1,
      pageSize: 1,
      from,
      to,
    });

    assert.equal(capturedWhere.startTime.gte.toISOString(), "2026-11-25T18:30:00.000Z");
    assert.equal(capturedWhere.startTime.lte.toISOString(), "2026-11-27T18:29:59.999Z");
    assert.equal(result.summary.totalShifts, 3);
    assert.equal(result.summary.completedShifts, 2);
    assert.equal(result.summary.activeShifts, 1);
    assert.equal(result.summary.totalVisits, 8);
    assert.equal(result.summary.totalDistanceKm, 22.5);
    assert.ok(result.summary.totalDurationSeconds >= 14390 && result.summary.totalDurationSeconds <= 14410);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.timing.totalShiftMins, 120);
  });

  await t.test("listAllShifts expands UTC-midnight `to` date strings to end-of-day for legacy callers", async () => {
    let capturedWhere: any = null;
    const mockDb: any = {
      shift: {
        count: async ({ where }: any) => {
          capturedWhere = where;
          return 0;
        },
        findMany: async () => [],
      },
    };

    const service = createShiftService(mockDb);
    await service.listAllShifts({
      page: 1,
      pageSize: 50,
      from: new Date("2026-11-27T00:00:00.000Z"),
      to: new Date("2026-11-27T00:00:00.000Z"),
    });

    assert.equal(capturedWhere.startTime.lte.toISOString(), "2026-11-27T23:59:59.999Z");
  });
});
