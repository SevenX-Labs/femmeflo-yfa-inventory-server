import { z } from "zod";
import { emailSchema, phoneSchema } from "../middleware/validation.js";
import { validateCoordinates } from "../utils/geo.utils.js";

const location = z.string().trim().min(1).max(100);

export const createCustomerSchema = z.strictObject({
  shopName: z.string().trim().min(1).max(100),
  contactName: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  email: emailSchema.optional(),
  categoryId: z.string().uuid(),
  sellerId: z.string().uuid().optional(),
  shopNumber: z.string().trim().max(100).optional(),
  streetName: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(20).optional(),
  address: z.string().trim().max(500).optional(),
  state: location,
  district: location,
  village: location,
  photoPath: z.string().trim().max(500).optional(),
  photoUrl: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
})
.superRefine((data, ctx) => {
  const result = validateCoordinates(data.latitude, data.longitude, { requireIndia: true, required: false });
  if (!result.valid && result.error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error,
      path: ["coordinates"],
    });
  }
})
.transform((data) => {
  const coords = validateCoordinates(data.latitude, data.longitude, { requireIndia: true, required: false });
  return {
    ...data,
    latitude: coords.latitude,
    longitude: coords.longitude,
    photoPath: data.photoPath ?? data.photoUrl ?? data.imageUrl,
  };
});

export const updateCustomerSchema = z.strictObject({
  shopName: z.string().trim().min(1).max(100).optional(),
  contactName: z.string().trim().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  categoryId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  shopNumber: z.string().trim().max(100).optional(),
  streetName: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(20).optional(),
  address: z.string().trim().max(500).optional(),
  state: location.optional(),
  district: location.optional(),
  village: location.optional(),
  photoPath: z.string().trim().max(500).optional(),
  photoUrl: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
  active: z.boolean().optional(),
})
.refine((value) => Object.keys(value).length > 0, "Provide at least one field")
.superRefine((data, ctx) => {
  const result = validateCoordinates(data.latitude, data.longitude, { requireIndia: true, required: false });
  if (!result.valid && result.error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error,
      path: ["coordinates"],
    });
  }
})
.transform((data) => {
  const coords = validateCoordinates(data.latitude, data.longitude, { requireIndia: true, required: false });
  const photo = data.photoPath ?? data.photoUrl ?? data.imageUrl;
  return {
    ...data,
    latitude: coords.latitude,
    longitude: coords.longitude,
    photoPath: photo !== undefined ? photo : data.photoPath,
  };
});

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
