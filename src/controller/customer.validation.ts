import { z } from "zod";
import { emailSchema, phoneSchema } from "../middleware/validation.js";

const location = z.string().trim().min(1).max(100);

export const createCustomerSchema = z.strictObject({
  shopName: z.string().trim().min(1).max(100),
  contactName: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  email: emailSchema.optional(),
  categoryId: z.string().uuid(),
  sellerId: z.string().uuid().optional(),
  state: location,
  district: location,
  village: location,
  photoPath: z.string().trim().max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const updateCustomerSchema = z.strictObject({
  shopName: z.string().trim().min(1).max(100).optional(),
  contactName: z.string().trim().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  categoryId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  state: location.optional(),
  district: location.optional(),
  village: location.optional(),
  photoPath: z.string().trim().max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one field");

export const listCustomersSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  state: location.optional(),
  district: location.optional(),
  village: location.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
