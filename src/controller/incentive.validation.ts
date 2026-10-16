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
