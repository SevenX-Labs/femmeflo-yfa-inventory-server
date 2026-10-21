import type { PrismaClient, Prisma } from "../generated/prisma/client.js";
import type {
  StartShiftInput,
  CheckInInput,
  EndShiftInput,
  ListShiftsQuery,
} from "../controller/shift.validation.js";
import { HttpError } from "../middleware/validation.js";
import { calculateRouteDistanceKm } from "../utils/distance.utils.js";

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
            include: { customer: { select: { id: true, shopName: true, phone: true } } },
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

    endShift: async (sellerId: string, input: EndShiftInput) => {
      const shift = await database.shift.findFirst({
        where: { sellerId, status: "ACTIVE" },
        include: { visits: { orderBy: { checkInTime: "asc" } } },
      });
      if (!shift) {
        throw new HttpError(400, "No active shift found");
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
          totalDistanceKm,
          status: "COMPLETED",
          notes: input.notes ?? null,
        },
        include: {
          visits: {
            orderBy: { checkInTime: "asc" },
            include: { customer: { select: { id: true, shopName: true, phone: true } } },
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
        if (query.to) where.startTime.lte = query.to;
      }

      const [total, items] = await Promise.all([
        database.shift.count({ where }),
        database.shift.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { startTime: "desc" },
          include: {
            visits: { orderBy: { checkInTime: "asc" } },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / query.pageSize);
      return {
        items,
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
        if (query.to) where.startTime.lte = query.to;
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
        items,
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
      return shift;
    },
  };
}

export type ShiftService = ReturnType<typeof createShiftService>;
