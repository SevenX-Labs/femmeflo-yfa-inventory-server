import { z } from "zod";

export const updateIncentiveSettingsSchema = z.strictObject({
  incentiveRatePaise: z.coerce.number().int().min(0).nullable().optional(),
  minimumPricePaise: z.coerce.number().int().positive().optional(),
}).refine((data) => Object.keys(data).length > 0, "Provide at least one setting to update");

export type UpdateIncentiveSettingsInput = z.infer<typeof updateIncentiveSettingsSchema>;
