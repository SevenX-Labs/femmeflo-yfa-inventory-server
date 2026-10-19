import { z } from "zod";

const saleLineItemSchema = z.strictObject({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitPricePaise: z.coerce.number().int().positive(),
});

export const createSaleSchema = z.union([
  z.strictObject({
    customerId: z.string().uuid(),
    quantity: z.coerce.number().int().positive(),
    unitPricePaise: z.coerce.number().int().positive(),
    paymentMode: z.enum(["CASH", "BANK", "PENDING"]),
    requestKey: z.string().trim().max(100).optional(),
  }),
  z.strictObject({
    customerId: z.string().uuid(),
    items: z.array(saleLineItemSchema).min(1).max(50),
    paymentMode: z.enum(["CASH", "BANK", "PENDING"]),
    requestKey: z.string().trim().max(100).optional(),
  }),
]);

export const listSalesSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING_APPROVAL", "CONFIRMED", "REJECTED"]).optional(),
  paymentMode: z.enum(["CASH", "BANK", "PENDING"]).optional(),
  period: z.enum(["all", "this_month", "last_month"]).optional(),
  customerId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});

export const rejectSaleSchema = z.strictObject({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ListSalesInput = z.infer<typeof listSalesSchema>;
export type RejectSaleInput = z.infer<typeof rejectSaleSchema>;

export const updateSaleSchema = z.strictObject({
  customerId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().positive().optional(),
  unitPricePaise: z.coerce.number().int().positive().optional(),
  paymentMode: z.enum(["CASH", "BANK", "PENDING"]).optional(),
});

export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
