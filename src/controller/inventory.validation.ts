import { z } from "zod";

export const createWarehouseSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});

export const createReceiptSchema = z.strictObject({
  quantity: z.coerce.number().int().positive(),
});

export const createTransferSchema = z.strictObject({
  sourceId: z.string().uuid(),
  destinationId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

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
