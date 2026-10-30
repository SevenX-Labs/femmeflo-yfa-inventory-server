import { z } from "zod";

export const createWarehouseSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});

const receiptItemSchema = z.strictObject({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

export const createReceiptSchema = z.union([
  z.strictObject({
    quantity: z.coerce.number().int().positive(),
    requestKey: z.string().trim().max(100).optional(),
  }),
  z.strictObject({
    items: z.array(receiptItemSchema).min(1).max(50),
    requestKey: z.string().trim().max(100).optional(),
  }),
]);

const transferItemSchema = z.strictObject({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

export const createTransferSchema = z.union([
  z.strictObject({
    sourceId: z.string().uuid(),
    destinationId: z.string().uuid(),
    quantity: z.coerce.number().int().positive(),
    requestKey: z.string().trim().max(100).optional(),
  }),
  z.strictObject({
    sourceId: z.string().uuid(),
    destinationId: z.string().uuid(),
    items: z.array(transferItemSchema).min(1).max(50),
    requestKey: z.string().trim().max(100).optional(),
  }),
]);

export const listTransactionsSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  locationId: z.string().uuid().optional(),
  type: z.enum(["RECEIPT", "TRANSFER", "SALE"]).optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;

export const updateLocationBalanceSchema = z.strictObject({
  balance: z.coerce.number().int().min(0, "Stock balance cannot be negative"),
  reason: z.string().trim().max(200).optional(),
});

export type UpdateLocationBalanceInput = z.infer<typeof updateLocationBalanceSchema>;
