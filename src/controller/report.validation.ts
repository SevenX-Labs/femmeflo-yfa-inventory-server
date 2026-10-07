import { z } from "zod";

const locationFilter = z.string().trim().min(1).max(100);

export const salesReportQuerySchema = z.strictObject({
  from: z.string().datetime().or(z.string().date()).optional(),
  to: z.string().datetime().or(z.string().date()).optional(),
  state: locationFilter.optional(),
  district: locationFilter.optional(),
  village: locationFilter.optional(),
  managerId: z.uuid().optional(),
  sellerId: z.uuid().optional(),
  paymentMode: z.enum(["CASH", "BANK", "PENDING"]).optional(),
  status: z.enum(["CONFIRMED", "PENDING_APPROVAL", "REJECTED"]).optional(),
  groupBy: z.enum(["date", "seller", "manager", "state", "district", "village"]).optional(),
  format: z.enum(["json", "csv", "xlsx"]).default("json"),
});

export const inventoryReportQuerySchema = z.strictObject({
  from: z.string().datetime().or(z.string().date()).optional(),
  to: z.string().datetime().or(z.string().date()).optional(),
  locationId: z.uuid().optional(),
  type: z.enum(["HQ", "WAREHOUSE", "SELLER"]).optional(),
  format: z.enum(["json", "csv", "xlsx"]).default("json"),
});

export type SalesReportQueryInput = z.infer<typeof salesReportQuerySchema>;
export type InventoryReportQueryInput = z.infer<typeof inventoryReportQuerySchema>;
