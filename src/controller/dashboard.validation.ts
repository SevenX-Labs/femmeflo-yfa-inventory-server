import { z } from "zod";

const location = z.string().trim().min(1).max(100);

export const dashboardFilterSchema = z.object({
  state: location.optional(),
  district: location.optional(),
  village: location.optional(),
  managerId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
}).passthrough();

export type DashboardFilterInput = z.infer<typeof dashboardFilterSchema>;
