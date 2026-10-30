import type { PrismaClient, Prisma } from "../generated/prisma/client.js";
import type {
  StartShiftInput,
  CheckInInput,
  CheckOutInput,
  EndShiftInput,
  ListShiftsQuery,
} from "../controller/shift.validation.js";
import { HttpError } from "../middleware/validation.js";
import { calculateRouteDistanceKm } from "../utils/distance.utils.js";

type VisitWithTiming = {
  checkInTime: Date;
  checkOutTime: Date | null;
  durationMins: number | null;
};

function enrichShiftWithTiming<T extends { startTime: Date; endTime: Date | null; visits: VisitWithTiming[] }>(
  shift: T
) {
  const totalShiftMins = shift.endTime
    ? Math.round((shift.endTime.getTime() - shift.startTime.getTime()) / 60000 * 100) / 100
    : null;
  const totalVisitMins = shift.visits.reduce(
    (sum, v) => sum + (v.durationMins ?? 0),
    0
  );
  const totalVisitMinsRounded = Math.round(totalVisitMins * 100) / 100;
  const travelMins = totalShiftMins !== null
    ? Math.round((totalShiftMins - totalVisitMinsRounded) * 100) / 100
    : null;

  return {
    ...shift,
    timing: {
      totalShiftMins,
      totalVisitMins: totalVisitMinsRounded,
      travelMins,
      visitCount: shift.visits.length,
    },
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

      return database.shift.create({
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

      return database.shiftVisit.update({
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

      return database.shift.update({
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
    },

    listSellerShifts: async (sellerId: string, query: ListShiftsQuery) => {
      const where: Prisma.ShiftWhereInput = { sellerId };
      if (query.status) where.status = query.status;
      if (query.from || query.to) {
        where.startTime = {};
        if (query.from) where.startTime.gte = query.from;
        if (query.to) {
          const toDate = new Date(query.to);
          if (
            toDate.getUTCHours() === 0 &&
            toDate.getUTCMinutes() === 0 &&
            toDate.getUTCSeconds() === 0 &&
            toDate.getUTCMilliseconds() === 0
          ) {
            toDate.setUTCHours(23, 59, 59, 999);
            where.startTime.lte = toDate;
          } else {
            where.startTime.lte = query.to;
          }
        }
      }

      const [total, items] = await Promise.all([
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
      ]);

      const totalPages = Math.ceil(total / query.pageSize);
      return {
        items: items.map(enrichShiftWithTiming),
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
      if (query.from || query.to) {
        where.startTime = {};
        if (query.from) where.startTime.gte = query.from;
        if (query.to) {
          const toDate = new Date(query.to);
          if (
            toDate.getUTCHours() === 0 &&
            toDate.getUTCMinutes() === 0 &&
            toDate.getUTCSeconds() === 0 &&
            toDate.getUTCMilliseconds() === 0
          ) {
            toDate.setUTCHours(23, 59, 59, 999);
            where.startTime.lte = toDate;
          } else {
            where.startTime.lte = query.to;
          }
        }
      }
      if (query.sellerId) {
        where.sellerId = query.sellerId;
      } else if (query.managerId) {
        where.seller = { managerId: query.managerId };
      } else if (managerIdScope) {
        where.seller = { managerId: managerIdScope };
      }

      const [total, items] = await Promise.all([
        database.shift.count({ where }),
        database.shift.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { startTime: "desc" },
          include: {
            seller: { select: { id: true, name: true, phone: true, employeeCode: true } },
            visits: { orderBy: { checkInTime: "asc" } },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / query.pageSize);
      return {
        items: items.map(enrichShiftWithTiming),
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
