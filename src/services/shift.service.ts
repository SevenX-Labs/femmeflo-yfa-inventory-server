import type { PrismaClient, Prisma } from "../generated/prisma/client.js";
import type {
  StartShiftInput,
  CheckInInput,
  CheckOutInput,
  EndShiftInput,
  ListShiftsQuery,
} from "../controller/shift.validation.js";
import { HttpError } from "../middleware/validation.js";
import { realtimeHub } from "./realtime/realtime.service.js";
import { calculateRouteDistanceKm } from "../utils/distance.utils.js";

type VisitWithTiming = {
  checkInTime: Date;
  checkOutTime: Date | null;
  durationMins: number | null;
};

function enrichShiftWithTiming<T extends { startTime: Date; endTime: Date | null; visits: VisitWithTiming[] }>(
  shift: T
) {
  const totalSeconds = shift.endTime
    ? Math.max(0, Math.floor((shift.endTime.getTime() - shift.startTime.getTime()) / 1000))
    : null;
  const totalShiftMins = totalSeconds !== null ? Math.round((totalSeconds / 60) * 100) / 100 : null;

  const rawVisitSeconds = shift.visits.reduce((sum, v) => {
    if (v.checkOutTime) {
      return sum + Math.max(0, Math.floor((v.checkOutTime.getTime() - v.checkInTime.getTime()) / 1000));
    }
    return sum + Math.round((v.durationMins ?? 0) * 60);
  }, 0);
  const clampedVisitSeconds =
    totalSeconds !== null ? Math.min(totalSeconds, rawVisitSeconds) : rawVisitSeconds;
  const totalVisitMinsRounded = Math.round((clampedVisitSeconds / 60) * 100) / 100;
  const travelSeconds = totalSeconds !== null ? Math.max(0, totalSeconds - clampedVisitSeconds) : null;
  const travelMins =
    travelSeconds !== null ? Math.round((travelSeconds / 60) * 100) / 100 : null;

  return {
    ...shift,
    timing: {
      totalShiftMins,
      totalVisitMins: totalVisitMinsRounded,
      travelMins,
      totalSeconds,
      totalVisitSeconds: clampedVisitSeconds,
      travelSeconds,
      visitCount: shift.visits.length,
    },
  };
}

function buildShiftStartTimeFilter(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const startTime: Prisma.DateTimeFilter = {};
  if (from) startTime.gte = from;
  if (to) {
    const toDate = new Date(to);
    if (
      toDate.getUTCHours() === 0 &&
      toDate.getUTCMinutes() === 0 &&
      toDate.getUTCSeconds() === 0 &&
      toDate.getUTCMilliseconds() === 0
    ) {
      toDate.setUTCHours(23, 59, 59, 999);
      startTime.lte = toDate;
    } else {
      startTime.lte = to;
    }
  }
  return startTime;
}

function aggregateShiftSummary(
  rows: Array<{
    status: string;
    startTime: Date;
    endTime: Date | null;
    totalDistanceKm: number;
    _count: { visits: number };
  }>,
  nowMs: number = Date.now()
) {
  let activeShifts = 0;
  let completedShifts = 0;
  let totalVisits = 0;
  let totalDistanceKm = 0;
  let totalDurationSeconds = 0;

  for (const row of rows) {
    if (row.status === "ACTIVE") activeShifts += 1;
    if (row.status === "COMPLETED") completedShifts += 1;
    totalVisits += row._count?.visits ?? 0;
    totalDistanceKm += Number(row.totalDistanceKm || 0);

    const endMs = row.endTime ? row.endTime.getTime() : row.status === "ACTIVE" ? nowMs : row.startTime.getTime();
    const diffSec = Math.max(0, Math.floor((endMs - row.startTime.getTime()) / 1000));
    totalDurationSeconds += diffSec;
  }

  return {
    totalShifts: rows.length,
    activeShifts,
    completedShifts,
    totalVisits,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDurationSeconds,
    totalDurationMins: Math.round(totalDurationSeconds / 60),
  };
}

export function createShiftService(database: PrismaClient) {
  return {
    startShift: async (sellerId: string, input: StartShiftInput) => {
      const existing = await database.shift.findFirst({
        where: { sellerId, status: "ACTIVE" },
        include: { visits: { orderBy: { checkInTime: "asc" } } },
      });
      if (existing) return existing;

      const shift = await database.shift.create({
        data: {
          sellerId,
          startLatitude: input.latitude,
          startLongitude: input.longitude,
          startAddress: input.address ?? null,
          startFaceVerified: input.faceVerified ?? true,
          startFacePhoto: input.facePhoto ?? null,
        },
        include: { visits: true },
      });

      realtimeHub.publish({
        type: "SHIFT_UPDATE",
        actorId: sellerId,
        role: "SELLER",
        entityId: shift.id,
        action: "START_SHIFT",
        targetUserIds: [sellerId],
        targetRoles: ["SUPER_ADMIN", "MANAGER"],
      });

      return shift;
    },

    getCurrentShift: async (sellerId: string) => {
      const shift = await database.shift.findFirst({
        where: { sellerId, status: "ACTIVE" },
        include: {
          visits: {
            orderBy: { checkInTime: "asc" },
            include: {
              customer: { select: { id: true, shopName: true, phone: true } },
              sale: { select: { id: true, totalPaise: true, quantity: true, paymentMode: true, status: true } },
            },
          },
        },
      });
      return shift;
    },

    checkIn: async (sellerId: string, input: CheckInInput) => {
      const shift = await database.shift.findFirst({
        where: { sellerId, status: "ACTIVE" },
      });
      if (!shift) {
        throw new HttpError(400, "No active shift found. Please start a shift first");
      }

      const visit = await database.shiftVisit.create({
        data: {
          shiftId: shift.id,
          customerId: input.customerId ?? null,
          shopName: input.shopName,
          latitude: input.latitude,
          longitude: input.longitude,
          notes: input.notes ?? null,
        },
        include: { customer: { select: { id: true, shopName: true, phone: true } } },
      });

      realtimeHub.publish({
        type: "SHIFT_UPDATE",
        actorId: sellerId,
        role: "SELLER",
        entityId: shift.id,
        action: "CHECK_IN",
        targetUserIds: [sellerId],
        targetRoles: ["SUPER_ADMIN", "MANAGER"],
        data: { shopName: input.shopName, visitId: visit.id },
      });

      return visit;
    },

    checkOut: async (sellerId: string, input: CheckOutInput) => {
      const shift = await database.shift.findFirst({
        where: { sellerId, status: "ACTIVE" },
      });
      if (!shift) {
        throw new HttpError(400, "No active shift found");
      }

      const visit = await database.shiftVisit.findUnique({
        where: { id: input.visitId },
      });
      if (!visit || visit.shiftId !== shift.id) {
        throw new HttpError(404, "Visit not found in current shift");
      }
      if (visit.checkOutTime) {
        throw new HttpError(400, "Already checked out from this shop");
      }

      const now = new Date();
      const durationMins = Math.round(
        (now.getTime() - visit.checkInTime.getTime()) / 60000 * 100
      ) / 100;

      const updatedVisit = await database.shiftVisit.update({
        where: { id: input.visitId },
        data: {
          checkOutTime: now,
          durationMins,
          notes: input.notes ?? visit.notes,
          saleDone: input.saleDone ?? false,
          customerFeedback: input.customerFeedback ?? null,
          saleId: input.saleId ?? null,
        },
        include: {
          customer: { select: { id: true, shopName: true, phone: true } },
          sale: { select: { id: true, totalPaise: true, quantity: true, paymentMode: true, status: true } },
        },
      });

      realtimeHub.publish({
        type: "SHIFT_UPDATE",
        actorId: sellerId,
        role: "SELLER",
        entityId: shift.id,
        action: "CHECK_OUT",
        targetUserIds: [sellerId],
        targetRoles: ["SUPER_ADMIN", "MANAGER"],
        data: { shopName: visit.shopName, visitId: visit.id, saleDone: input.saleDone },
      });

      return updatedVisit;
    },

    endShift: async (sellerId: string, input: EndShiftInput) => {
      const shift = await database.shift.findFirst({
        where: { sellerId, status: "ACTIVE" },
        include: { visits: { orderBy: { checkInTime: "asc" } } },
      });
      if (!shift) {
        throw new HttpError(400, "No active shift found");
      }

      const now = new Date();
      const uncheckedOut = shift.visits.filter((v) => !v.checkOutTime);
      if (uncheckedOut.length > 0) {
        await Promise.all(
          uncheckedOut.map((v) => {
            const durationMins = Math.round(
              (now.getTime() - v.checkInTime.getTime()) / 60000 * 100
            ) / 100;
            return database.shiftVisit.update({
              where: { id: v.id },
              data: { checkOutTime: now, durationMins },
            });
          })
        );
      }

      const routePoints = [
        { lat: shift.startLatitude, lng: shift.startLongitude },
        ...shift.visits.map((v) => ({ lat: v.latitude, lng: v.longitude })),
        { lat: input.latitude, lng: input.longitude },
      ];

      const totalDistanceKm = await calculateRouteDistanceKm(routePoints);

      const updatedShift = await database.shift.update({
        where: { id: shift.id },
        data: {
          endTime: new Date(),
          endLatitude: input.latitude,
          endLongitude: input.longitude,
          endAddress: input.address ?? null,
          endFaceVerified: input.faceVerified ?? true,
          endFacePhoto: input.facePhoto ?? null,
          totalDistanceKm,
          status: "COMPLETED",
          notes: input.notes ?? null,
        },
        include: {
          visits: {
            orderBy: { checkInTime: "asc" },
            include: {
              customer: { select: { id: true, shopName: true, phone: true } },
              sale: { select: { id: true, totalPaise: true, quantity: true, paymentMode: true, status: true } },
            },
          },
        },
      });

      realtimeHub.publish({
        type: "SHIFT_UPDATE",
        actorId: sellerId,
        role: "SELLER",
        entityId: shift.id,
        action: "END_SHIFT",
        targetUserIds: [sellerId],
        targetRoles: ["SUPER_ADMIN", "MANAGER"],
        data: { totalDistanceKm },
      });

      return updatedShift;
    },

    listSellerShifts: async (sellerId: string, query: ListShiftsQuery) => {
      const where: Prisma.ShiftWhereInput = { sellerId };
      if (query.status) where.status = query.status;
      const startTimeFilter = buildShiftStartTimeFilter(query.from, query.to);
      if (startTimeFilter) where.startTime = startTimeFilter;

      const [total, items, summaryRows] = await Promise.all([
        database.shift.count({ where }),
        database.shift.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { startTime: "desc" },
          include: {
            visits: {
              orderBy: { checkInTime: "asc" },
              include: {
                customer: { select: { id: true, shopName: true, phone: true } },
                sale: { select: { id: true, totalPaise: true, quantity: true, paymentMode: true, status: true } },
              },
            },
          },
        }),
        database.shift.findMany({
          where,
          select: {
            status: true,
            startTime: true,
            endTime: true,
            totalDistanceKm: true,
            _count: { select: { visits: true } },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / query.pageSize);
      return {
        items: items.map(enrichShiftWithTiming),
        summary: aggregateShiftSummary(summaryRows),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: totalPages === 0 && total === 0 ? 0 : Math.max(1, totalPages),
        },
      };
    },

    listAllShifts: async (query: ListShiftsQuery, managerIdScope?: string) => {
      const where: Prisma.ShiftWhereInput = {};
      if (query.status) where.status = query.status;
      const startTimeFilter = buildShiftStartTimeFilter(query.from, query.to);
      if (startTimeFilter) where.startTime = startTimeFilter;
      if (query.sellerId) {
        where.sellerId = query.sellerId;
      } else if (query.managerId) {
        where.seller = { managerId: query.managerId };
      } else if (managerIdScope) {
        where.OR = [
          { sellerId: managerIdScope },
          { seller: { managerId: managerIdScope } },
        ];
      }

      const [total, items, summaryRows] = await Promise.all([
        database.shift.count({ where }),
        database.shift.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { startTime: "desc" },
          include: {
            seller: { select: { id: true, name: true, phone: true, employeeCode: true } },
            visits: {
              orderBy: { checkInTime: "asc" },
              include: {
                customer: { select: { id: true, shopName: true, phone: true } },
                sale: { select: { id: true, totalPaise: true, quantity: true, paymentMode: true, status: true, customerFeedback: true } },
              },
            },
          },
        }),
        database.shift.findMany({
          where,
          select: {
            status: true,
            startTime: true,
            endTime: true,
            totalDistanceKm: true,
            _count: { select: { visits: true } },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / query.pageSize);
      return {
        items: items.map(enrichShiftWithTiming),
        summary: aggregateShiftSummary(summaryRows),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: totalPages === 0 && total === 0 ? 0 : Math.max(1, totalPages),
        },
      };
    },

    getShiftById: async (shiftId: string) => {
      const shift = await database.shift.findUnique({
        where: { id: shiftId },
        include: {
          seller: { select: { id: true, name: true, phone: true, employeeCode: true } },
          visits: {
            orderBy: { checkInTime: "asc" },
            include: { customer: { select: { id: true, shopName: true, phone: true } } },
          },
        },
      });
      if (!shift) throw new HttpError(404, "Shift not found");
      return enrichShiftWithTiming(shift);
    },
  };
}

export type ShiftService = ReturnType<typeof createShiftService>;
