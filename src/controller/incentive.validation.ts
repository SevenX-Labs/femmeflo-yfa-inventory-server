import { z } from "zod";

export const updateIncentiveSettingsSchema = z.strictObject({
  incentiveRatePaise: z.coerce.number().int().min(0).nullable().optional(),
  minimumPricePaise: z.coerce.number().int().positive().optional(),
  companyName: z.string().trim().min(1).max(150).optional(),
  companyGst: z.string().trim().max(30).optional(),
  companyAddress: z.string().trim().max(300).optional(),
  companyPhone: z.string().trim().max(25).optional(),
  companyEmail: z.string().trim().max(100).optional(),
  companyPan: z.string().trim().max(20).optional(),
  invoiceTerms: z.string().trim().max(500).optional(),
}).refine((data) => Object.keys(data).length > 0, "Provide at least one setting to update");

export type UpdateIncentiveSettingsInput = z.infer<typeof updateIncentiveSettingsSchema>;

export const updateUserRateSchema = z.object({
  ratePaise: z.coerce.number().int().min(0, "Incentive rate must be a non-negative amount in paise"),
  effectiveDate: z.string().optional(),
  reason: z.string().trim().max(300, "Reason must not exceed 300 characters").optional(),
});

export type UpdateUserRateInput = z.infer<typeof updateUserRateSchema>;

export const createAdjustmentSchema = z.object({
  type: z.enum(["ADD", "DEDUCT"]),
  amountPaise: z.coerce.number().int().positive("Adjustment amount must be greater than zero"),
  reason: z.string().trim().min(2, "Reason is required (min 2 characters)").max(300, "Reason must not exceed 300 characters"),
  adjustmentDate: z.string().optional(),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

export const createPayoutSchema = z.object({
  amountPaise: z.coerce.number().int().positive("Payment amount must be greater than zero"),
  paymentMethod: z.string().trim().min(1, "Payment method is required").max(50).default("BANK"),
  referenceId: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(300).optional(),
  paymentDate: z.string().optional(),
  requestKey: z.string().trim().max(100).optional(),
  periodYear: z.coerce.number().int().min(2020).max(2100).optional(),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;

export const listIncentivesQuerySchema = z.object({
  role: z.enum(["SELLER", "MANAGER", "ALL"]).optional(),
  managerId: z.string().uuid().optional(),
  status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID", "ALL"]).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  search: z.string().trim().optional(),
});

export type ListIncentivesQuery = z.infer<typeof listIncentivesQuerySchema>;
