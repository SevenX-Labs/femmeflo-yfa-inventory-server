import { z } from "zod";

export const startShiftSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().trim().max(500).optional(),
});

export const checkInSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  shopName: z.string().trim().min(1).max(200),
  customerId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const endShiftSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const listShiftsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sellerId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export type StartShiftInput = z.infer<typeof startShiftSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type EndShiftInput = z.infer<typeof endShiftSchema>;
export type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>;
