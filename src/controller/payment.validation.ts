import { z } from "zod";

export const collectPaymentSchema = z.strictObject({
  mode: z.enum(["CASH", "BANK"]),
});

export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;
