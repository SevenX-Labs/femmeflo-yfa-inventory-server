import { z } from "zod";
import { emailSchema, phoneSchema, passwordSchema } from "../middleware/validation.js";
import { managerPermissions } from "../middleware/rbac.middleware.js";

const location = z.string().trim().min(1).max(100);
const userFields = {
  name: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  email: emailSchema.optional(),
  state: location.optional(), district: location.optional(), village: location.optional(),
};

export const permissionsSchema = z.strictObject({ permissions: z.array(z.enum(managerPermissions)).max(managerPermissions.length).transform((values) => [...new Set(values)]) });
export const createManagerSchema = z.strictObject({ ...userFields, password: passwordSchema, permissions: permissionsSchema.shape.permissions.default([]) });
export const createSellerSchema = z.strictObject({ ...userFields, password: passwordSchema, managerId: z.uuid() });
export const managerCreateSellerSchema = createSellerSchema.omit({ managerId: true });
export const updateUserSchema = z.strictObject({ ...userFields, active: z.boolean() }).partial().refine((value) => Object.keys(value).length > 0, "Provide at least one field");

export const listUsersSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  managerId: z.uuid().optional(),
  state: location.optional(), district: location.optional(), village: location.optional(),
});

export type CreateManagerInput = z.infer<typeof createManagerSchema>;
export type CreateSellerInput = z.infer<typeof createSellerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
