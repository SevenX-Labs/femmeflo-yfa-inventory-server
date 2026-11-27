import { z } from "zod";

export const collectPaymentSchema = z.strictObject({
  mode: z.enum(["CASH", "BANK"]),
});

export const markPaymentSentSchema = z.strictObject({
  remark: z.string().trim().max(500).optional(),
  sentAt: z.string().trim().max(64).optional(),
});

export const receiveSalePaymentSchema = z.strictObject({
  remark: z.string().trim().max(500).optional(),
  receivedAt: z.string().trim().max(64).optional(),
});

export const bulkCompleteSalesSchema = z.strictObject({
  saleIds: z.array(z.string().uuid()).min(1).max(200),
  remark: z.string().trim().max(500).optional(),
  receivedAt: z.string().trim().max(64).optional(),
});

export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;
export type MarkPaymentSentInput = z.infer<typeof markPaymentSentSchema>;
export type ReceiveSalePaymentInput = z.infer<typeof receiveSalePaymentSchema>;
export type BulkCompleteSalesInput = z.infer<typeof bulkCompleteSalesSchema>;
