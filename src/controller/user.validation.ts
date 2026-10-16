import { z } from "zod";
import { emailSchema, phoneSchema, passwordSchema } from "../middleware/validation.js";
import { managerPermissions } from "../middleware/rbac.middleware.js";

const location = z.string().trim().min(1).max(100);
const pincodeRegex = /^[1-9][0-9]{5}$/;

const userFields = {
  name: z.string().trim().min(1, "Employee name is required").max(100),
  phone: phoneSchema,
  alternatePhone: phoneSchema.optional(),
  email: emailSchema.optional(),
  designation: z.string().trim().max(100).optional(),
  employeeCode: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  pincode: z.string().trim().regex(pincodeRegex, "Pincode must be 6 digits").optional().or(z.literal("")),
  aadharNumber: z.string().trim().max(20).optional().or(z.literal("")),
  drivingLicense: z.string().trim().max(50).optional().or(z.literal("")),
  education: z.string().trim().max(100).optional().or(z.literal("")),
  state: location.optional(),
  district: location.optional(),
  village: location.optional(),
};

function refineNoDuplicatePhone(data: { phone?: string | undefined; alternatePhone?: string | undefined }) {
  if (data.phone && data.alternatePhone) {
    const p1 = data.phone.replace(/\D/g, "").slice(-10);
    const p2 = data.alternatePhone.replace(/\D/g, "").slice(-10);
    if (p1 && p2 && p1 === p2) {
      return false;
    }
  }
  return true;
}

export const permissionsSchema = z.strictObject({
  permissions: z
    .array(z.enum(managerPermissions))
    .max(managerPermissions.length)
    .transform((values) => [...new Set(values)]),
});

export const createManagerSchema = z
  .strictObject({
    ...userFields,
    password: passwordSchema,
    permissions: permissionsSchema.shape.permissions.default([]),
  })
  .refine(refineNoDuplicatePhone, {
    message: "Alternate phone number cannot be the same as primary phone number",
    path: ["alternatePhone"],
  });

export const createSellerSchema = z
  .strictObject({
    ...userFields,
    password: passwordSchema,
    managerId: z.uuid(),
    active: z.boolean().default(true),
  })
  .refine(refineNoDuplicatePhone, {
    message: "Alternate phone number cannot be the same as primary phone number",
    path: ["alternatePhone"],
  });

export const managerCreateSellerSchema = z
  .strictObject({
    ...userFields,
    password: passwordSchema,
    active: z.boolean().default(true),
  })
  .refine(refineNoDuplicatePhone, {
    message: "Alternate phone number cannot be the same as primary phone number",
    path: ["alternatePhone"],
  });

export const updateUserSchema = z
  .strictObject({
    ...userFields,
    managerId: z.uuid().optional(),
    active: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field")
  .refine(refineNoDuplicatePhone, {
    message: "Alternate phone number cannot be the same as primary phone number",
    path: ["alternatePhone"],
  });

export const listUsersSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().max(100).optional(),
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  managerId: z.uuid().optional(),
  state: location.optional(),
  district: location.optional(),
  village: location.optional(),
});

export type CreateManagerInput = z.infer<typeof createManagerSchema>;
export type CreateSellerInput = z.infer<typeof createSellerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
