import type { PrismaClient } from "../../generated/prisma/client.js";
import type { SellerReportQueryInput } from "../../controller/report.validation.js";
import { calculateRouteDistanceKm } from "../../utils/distance.utils.js";
import { getISTDateComponents, parseISTDateRange } from "../../utils/timezone.utils.js";
import {
  calculateUserIncentiveSummary,
  type RawAdjustmentRecord,
  type RawPayoutRecord,
  type RawSaleRecord,
  type SalesTargetPeriod,
} from "../incentive/incentive.calculator.js";
import { syncUserTargetBonusAdjustment } from "../incentive/target-bonus.service.js";
import { DEFAULT_INCENTIVE_RATE_PAISE, getCachedBusinessSettings } from "../settings.cache.js";

const CONFIRMED_SALE_STATUSES = new Set(["CONFIRMED", "COMPLETED"]);

export interface SellerReportSaleRow {
  id: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  paymentMode: string;
  status: string;
  incentiveRatePaise: number | null;
  incentiveAmountPaise: number | null;
  confirmedAt: Date | string | null;
  createdAt: Date | string;
  customer: {
    id: string;
    shopName: string;
    contactName: string;
    village: string;
  };
}

export interface SellerReportVisitRow {
  id: string;
  shopName: string;
  latitude: number;
  longitude: number;
  checkInTime: Date | string;
  checkOutTime: Date | string | null;
  durationMins: number | null;
  saleDone: boolean | null;
  saleId: string | null;
  notes: string | null;
  customer: {
    id: string;
    shopName: string;
    phone: string;
  } | null;
  sale: {
    id: string;
    totalPaise: number;
    quantity: number;
    paymentMode: string;
    status: string;
  } | null;
}

export interface SellerReportShiftRow {
  id: string;
  startTime: Date | string;
  endTime: Date | string | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number | null;
  endLongitude: number | null;
  startAddress: string | null;
  endAddress: string | null;
  totalDistanceKm: number;
  status: string;
  visits: SellerReportVisitRow[];
}

export interface SellerReportDailyVisitItem {
  id: string;
  shiftId: string;
  shopName: string;
  customerId: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  durationMins: number | null;
  saleDone: boolean;
  saleId: string | null;
  saleTotalPaise: number | null;
  saleQuantity: number | null;
  notes: string | null;
}

export interface SellerReportDailySaleItem {
  id: string;
  shopName: string;
  customerId: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  paymentMode: string;
  status: string;
  incentivePaise: number;
  createdAt: string;
}

export interface SellerReportDailyAdjustmentItem {
  id: string;
  type: "ADD" | "DEDUCT";
  amountPaise: number;
  reason: string;
  adjustmentDate: string;
}

export interface SellerReportDailyRecord {
  date: string;
  shiftsCount: number;
  activeShiftsCount: number;
  shopsVisited: number;
  uniqueShopsVisited: number;
  salesDoneVisits: number;
  travelKm: number;
  durationSeconds: number;
  ordersCount: number;
  confirmedOrdersCount: number;
  pendingOrdersCount: number;
  rejectedOrdersCount: number;
  packetsSold: number;
  salesPaise: number;
  cashPaise: number;
  bankPaise: number;
  pendingPaise: number;
  baseCommissionPaise: number;
  additionsPaise: number;
  deductionsPaise: number;
  netIncentivePaise: number;
  visits: SellerReportDailyVisitItem[];
  sales: SellerReportDailySaleItem[];
  adjustments: SellerReportDailyAdjustmentItem[];
}

function toISTDateKey(input: Date | string): string {
  const { year, month, day } = getISTDateComponents(new Date(input));
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildShiftRoutePoints(shift: SellerReportShiftRow): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [
    { lat: shift.startLatitude, lng: shift.startLongitude },
  ];
  for (const visit of shift.visits) {
    points.push({ lat: visit.latitude, lng: visit.longitude });
  }
  if (shift.endLatitude != null && shift.endLongitude != null) {
    points.push({ lat: shift.endLatitude, lng: shift.endLongitude });
  }
  return points;
}

function computeShiftDistanceKmSync(shift: SellerReportShiftRow): number {
  if (Number.isFinite(shift.totalDistanceKm) && shift.totalDistanceKm > 0) {
    return shift.totalDistanceKm;
  }
  const points = buildShiftRoutePoints(shift);
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const segKm = haversineDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng);
    if (segKm >= 0.06) {
      total += segKm;
    }
  }
  return Math.round(total * 100) / 100;
}

function computeShiftDurationSeconds(shift: SellerReportShiftRow, nowMs: number): number {
  const startMs = new Date(shift.startTime).getTime();
  const endMs = shift.endTime
    ? new Date(shift.endTime).getTime()
    : shift.status === "ACTIVE"
      ? nowMs
      : startMs;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function isInDateBounds(dateValue: Date | string, bounds?: { gte?: Date; lt?: Date }): boolean {
  if (!bounds) return true;
  const ts = new Date(dateValue).getTime();
  if (bounds.gte && ts < bounds.gte.getTime()) return false;
  if (bounds.lt && ts >= bounds.lt.getTime()) return false;
  return true;
}

function resolveSaleCommissionPaise(sale: SellerReportSaleRow, effectiveRatePaise: number): number {
  if (!CONFIRMED_SALE_STATUSES.has(sale.status)) {
    return 0;
  }
  const rate = sale.incentiveRatePaise ?? effectiveRatePaise;
  return sale.incentiveAmountPaise ?? sale.quantity * rate;
}

export function buildSellerReportPayload(params: {
  sellerId: string;
  from?: string | undefined;
  to?: string | undefined;
  now?: Date | undefined;
  effectiveRatePaise: number;
  shifts: SellerReportShiftRow[];
  periodSales: SellerReportSaleRow[];
  allConfirmedSales: RawSaleRecord[];
  allAdjustments: RawAdjustmentRecord[];
  payouts: RawPayoutRecord[];
  targetProgress: Awaited<ReturnType<typeof syncUserTargetBonusAdjustment>>["progress"];
}) {
  const now = params.now ?? new Date();
  const nowMs = now.getTime();
  const bounds = parseISTDateRange(params.from, params.to);

  const periodAdjustments = params.allAdjustments.filter((adj) =>
    isInDateBounds(adj.adjustmentDate ?? adj.createdAt, bounds)
  );

  const dayMap = new Map<
    string,
    {
      record: SellerReportDailyRecord;
      shopKeys: Set<string>;
    }
  >();

  const ensureDay = (dateKey: string) => {
    let entry = dayMap.get(dateKey);
    if (!entry) {
      entry = {
        record: {
          date: dateKey,
          shiftsCount: 0,
          activeShiftsCount: 0,
          shopsVisited: 0,
          uniqueShopsVisited: 0,
          salesDoneVisits: 0,
          travelKm: 0,
          durationSeconds: 0,
          ordersCount: 0,
          confirmedOrdersCount: 0,
          pendingOrdersCount: 0,
          rejectedOrdersCount: 0,
          packetsSold: 0,
          salesPaise: 0,
          cashPaise: 0,
          bankPaise: 0,
          pendingPaise: 0,
          baseCommissionPaise: 0,
          additionsPaise: 0,
          deductionsPaise: 0,
          netIncentivePaise: 0,
          visits: [],
          sales: [],
          adjustments: [],
        },
        shopKeys: new Set<string>(),
      };
      dayMap.set(dateKey, entry);
    }
    return entry;
  };

  let shiftsCount = 0;
  let activeShiftsCount = 0;
  let completedShiftsCount = 0;
  let totalTravelKm = 0;
  let totalDurationSeconds = 0;
  let totalShopsVisited = 0;
  let totalSalesDoneVisits = 0;
  const overallShopKeys = new Set<string>();

  for (const shift of params.shifts) {
    const dayKey = toISTDateKey(shift.startTime);
    const dayEntry = ensureDay(dayKey);
    const shiftKm = computeShiftDistanceKmSync(shift);
    const shiftSec = computeShiftDurationSeconds(shift, nowMs);

    shiftsCount += 1;
    if (shift.status === "ACTIVE") activeShiftsCount += 1;
    if (shift.status === "COMPLETED") completedShiftsCount += 1;
    totalTravelKm += shiftKm;
    totalDurationSeconds += shiftSec;

    dayEntry.record.shiftsCount += 1;
    if (shift.status === "ACTIVE") dayEntry.record.activeShiftsCount += 1;
    dayEntry.record.travelKm += shiftKm;
    dayEntry.record.durationSeconds += shiftSec;

    for (const visit of shift.visits) {
      totalShopsVisited += 1;
      dayEntry.record.shopsVisited += 1;

      const resolvedShopName = visit.customer?.shopName || visit.shopName;
      const shopIdentity = visit.customer?.id || resolvedShopName.trim().toLowerCase();
      overallShopKeys.add(shopIdentity);
      dayEntry.shopKeys.add(shopIdentity);

      const saleDone = Boolean(visit.saleDone || visit.saleId || visit.sale);
      if (saleDone) {
        totalSalesDoneVisits += 1;
        dayEntry.record.salesDoneVisits += 1;
      }

      dayEntry.record.visits.push({
        id: visit.id,
        shiftId: shift.id,
        shopName: resolvedShopName,
        customerId: visit.customer?.id ?? null,
        checkInTime: new Date(visit.checkInTime).toISOString(),
        checkOutTime: visit.checkOutTime ? new Date(visit.checkOutTime).toISOString() : null,
        durationMins: visit.durationMins ?? null,
        saleDone,
        saleId: visit.saleId ?? visit.sale?.id ?? null,
        saleTotalPaise: visit.sale?.totalPaise ?? null,
        saleQuantity: visit.sale?.quantity ?? null,
        notes: visit.notes ?? null,
      });
    }
  }

  let ordersCount = 0;
  let confirmedOrdersCount = 0;
  let pendingOrdersCount = 0;
  let rejectedOrdersCount = 0;
  let totalPacketsSold = 0;
  let totalSalesPaise = 0;
  let cashPaise = 0;
  let bankPaise = 0;
  let pendingPaise = 0;
  let baseCommissionPaise = 0;

  for (const sale of params.periodSales) {
    const dayKey = toISTDateKey(sale.createdAt);
    const dayEntry = ensureDay(dayKey);
    const commissionPaise = resolveSaleCommissionPaise(sale, params.effectiveRatePaise);
    const isConfirmed = CONFIRMED_SALE_STATUSES.has(sale.status);

    ordersCount += 1;
    dayEntry.record.ordersCount += 1;

    if (isConfirmed) {
      confirmedOrdersCount += 1;
      totalPacketsSold += sale.quantity;
      totalSalesPaise += sale.totalPaise;
      baseCommissionPaise += commissionPaise;

      dayEntry.record.confirmedOrdersCount += 1;
      dayEntry.record.packetsSold += sale.quantity;
      dayEntry.record.salesPaise += sale.totalPaise;
      dayEntry.record.baseCommissionPaise += commissionPaise;

      if (sale.paymentMode === "CASH") {
        cashPaise += sale.totalPaise;
        dayEntry.record.cashPaise += sale.totalPaise;
      } else if (sale.paymentMode === "BANK") {
        bankPaise += sale.totalPaise;
        dayEntry.record.bankPaise += sale.totalPaise;
      } else {
        pendingPaise += sale.totalPaise;
        dayEntry.record.pendingPaise += sale.totalPaise;
      }
    } else if (sale.status === "PENDING_APPROVAL") {
      pendingOrdersCount += 1;
      dayEntry.record.pendingOrdersCount += 1;
    } else if (sale.status === "REJECTED") {
      rejectedOrdersCount += 1;
      dayEntry.record.rejectedOrdersCount += 1;
    }

    dayEntry.record.sales.push({
      id: sale.id,
      shopName: sale.customer.shopName,
      customerId: sale.customer.id,
      quantity: sale.quantity,
      unitPricePaise: sale.unitPricePaise,
      totalPaise: sale.totalPaise,
      paymentMode: sale.paymentMode,
      status: sale.status,
      incentivePaise: commissionPaise,
      createdAt: new Date(sale.createdAt).toISOString(),
    });
  }

  let additionsPaise = 0;
  let deductionsPaise = 0;

  for (const adjustment of periodAdjustments) {
    const adjDate = adjustment.adjustmentDate ?? adjustment.createdAt;
    const dayKey = toISTDateKey(adjDate);
    const dayEntry = ensureDay(dayKey);

    if (adjustment.type === "ADD") {
      additionsPaise += adjustment.amountPaise;
      dayEntry.record.additionsPaise += adjustment.amountPaise;
    } else {
      deductionsPaise += adjustment.amountPaise;
      dayEntry.record.deductionsPaise += adjustment.amountPaise;
    }

    dayEntry.record.adjustments.push({
      id: adjustment.id,
      type: adjustment.type,
      amountPaise: adjustment.amountPaise,
      reason: adjustment.reason,
      adjustmentDate: new Date(adjDate).toISOString(),
    });
  }

  const dailyRecords: SellerReportDailyRecord[] = Array.from(dayMap.values())
    .map(({ record, shopKeys }) => {
      record.uniqueShopsVisited = shopKeys.size;
      record.travelKm = roundKm(record.travelKm);
      record.netIncentivePaise = Math.max(
        0,
        record.baseCommissionPaise + record.additionsPaise - record.deductionsPaise
      );
      record.visits.sort(
        (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
      );
      record.sales.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return record;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const lifetimeSummary = calculateUserIncentiveSummary(
    params.sellerId,
    params.allConfirmedSales,
    params.allAdjustments,
    params.payouts,
    now,
    params.effectiveRatePaise
  );

  const periodNetIncentivePaise = Math.max(
    0,
    baseCommissionPaise + additionsPaise - deductionsPaise
  );

  return {
    range: {
      from: params.from ?? null,
      to: params.to ?? null,
    },
    ratePerPacketPaise: params.effectiveRatePaise,
    summary: {
      activeDays: dailyRecords.length,
      shiftsCount,
      activeShiftsCount,
      completedShiftsCount,
      shopsVisited: totalShopsVisited,
      uniqueShopsVisited: overallShopKeys.size,
      salesDoneVisits: totalSalesDoneVisits,
      conversionRatePercent:
        totalShopsVisited > 0
          ? Math.round((totalSalesDoneVisits / totalShopsVisited) * 100)
          : 0,
      totalDistanceKm: roundKm(totalTravelKm),
      totalDurationSeconds,
      ordersCount,
      confirmedOrdersCount,
      pendingOrdersCount,
      rejectedOrdersCount,
      totalPacketsSold,
      totalSalesPaise,
      cashPaise,
      bankPaise,
      pendingPaise,
      baseCommissionPaise,
      additionsPaise,
      deductionsPaise,
      netIncentivePaise: periodNetIncentivePaise,
    },
    incentiveOverview: {
      ratePerPacketPaise: params.effectiveRatePaise,
      salesIncentivePaise: lifetimeSummary.salesIncentivePaise,
      additionsPaise: lifetimeSummary.additionsPaise,
      deductionsPaise: lifetimeSummary.deductionsPaise,
      totalEarnedPaise: lifetimeSummary.adjustedEntitlementPaise,
      totalPaidPaise: lifetimeSummary.totalPaidPaise,
      outstandingPaise: lifetimeSummary.outstandingPaise,
      status: lifetimeSummary.status,
    },
    targetProgress: params.targetProgress,
    dailyRecords,
  };
}

export function createSellerReportService(database: PrismaClient) {
  return {
    getReport: async (sellerId: string, query: SellerReportQueryInput) => {
      const now = new Date();
      const rangeFilter = parseISTDateRange(query.from, query.to);

      const [settings, sellerUser, shifts, periodSales, allConfirmedSales, adjustments, payouts] =
        await Promise.all([
          getCachedBusinessSettings(database),
          database.user.findUnique({
            where: { id: sellerId },
            select: {
              incentiveRatePaise: true,
              salesTargetPackets: true,
              salesTargetPeriod: true,
              targetBonusPaise: true,
            },
          }),
          database.shift.findMany({
            where: {
              sellerId,
              ...(rangeFilter ? { startTime: rangeFilter } : {}),
            },
            orderBy: { startTime: "desc" },
            include: {
              visits: {
                orderBy: { checkInTime: "asc" },
                include: {
                  customer: { select: { id: true, shopName: true, phone: true } },
                  sale: {
                    select: {
                      id: true,
                      totalPaise: true,
                      quantity: true,
                      paymentMode: true,
                      status: true,
                    },
                  },
                },
              },
            },
          }),
          database.sale.findMany({
            where: {
              sellerId,
              ...(rangeFilter ? { createdAt: rangeFilter } : {}),
            },
            orderBy: { createdAt: "desc" },
            include: {
              customer: {
                select: { id: true, shopName: true, contactName: true, village: true },
              },
            },
          }),
          database.sale.findMany({
            where: {
              sellerId,
              status: { in: ["CONFIRMED", "COMPLETED"] },
            },
            orderBy: { confirmedAt: "desc" },
            select: {
              id: true,
              quantity: true,
              totalPaise: true,
              incentiveRatePaise: true,
              incentiveAmountPaise: true,
              confirmedAt: true,
              createdAt: true,
            },
          }),
          database.incentiveAdjustment.findMany({
            where: { userId: sellerId },
            orderBy: { adjustmentDate: "desc" },
            select: {
              id: true,
              type: true,
              amountPaise: true,
              reason: true,
              adjustmentDate: true,
              createdAt: true,
            },
          }),
          database.incentivePayout.findMany({
            where: { userId: sellerId },
            orderBy: { paymentDate: "desc" },
            select: {
              id: true,
              amountPaise: true,
              paymentDate: true,
              paymentMethod: true,
              referenceId: true,
              remarks: true,
              createdAt: true,
              allocations: {
                select: {
                  periodYear: true,
                  periodMonth: true,
                  amountPaise: true,
                },
              },
            },
          }),
        ]);

      const effectiveRatePaise =
        sellerUser?.incentiveRatePaise ??
        settings.incentiveRatePaise ??
        DEFAULT_INCENTIVE_RATE_PAISE;

      const { progress: targetProgress, createdAdjustment } =
        await syncUserTargetBonusAdjustment(database, {
          userId: sellerId,
          salesTargetPackets: sellerUser?.salesTargetPackets ?? null,
          salesTargetPeriod: (sellerUser?.salesTargetPeriod as SalesTargetPeriod | undefined) ?? "MONTHLY",
          targetBonusPaise: sellerUser?.targetBonusPaise ?? null,
          confirmedSales: allConfirmedSales,
          existingAdjustments: adjustments,
          actorUserId: sellerId,
          referenceDate: now,
        });

      const resolvedAdjustments = createdAdjustment
        ? [
            {
              id: createdAdjustment.id,
              type: createdAdjustment.type,
              amountPaise: createdAdjustment.amountPaise,
              reason: createdAdjustment.reason,
              adjustmentDate: createdAdjustment.adjustmentDate,
              createdAt: createdAdjustment.createdAt,
            },
            ...adjustments,
          ]
        : adjustments;

      const shiftsWithDistance = await Promise.all(
        shifts.map(async (shift) => {
          if (Number.isFinite(shift.totalDistanceKm) && shift.totalDistanceKm > 0) {
            return shift;
          }
          const points = buildShiftRoutePoints(shift);
          if (points.length < 2) {
            return shift;
          }
          const calculatedKm = await calculateRouteDistanceKm(points);
          return {
            ...shift,
            totalDistanceKm: calculatedKm,
          };
        })
      );

      return buildSellerReportPayload({
        sellerId,
        from: query.from,
        to: query.to,
        now,
        effectiveRatePaise,
        shifts: shiftsWithDistance,
        periodSales,
        allConfirmedSales,
        allAdjustments: resolvedAdjustments,
        payouts,
        targetProgress,
      });
    },
  };
}

export type SellerReportService = ReturnType<typeof createSellerReportService>;
