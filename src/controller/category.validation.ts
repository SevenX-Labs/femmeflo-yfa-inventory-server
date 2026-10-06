import { z } from "zod";

export const createCategorySchema = z.strictObject({
  name: z.string().trim().min(1).max(50),
});

export const updateCategorySchema = z.strictObject({
  name: z.string().trim().min(1).max(50).optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one field");

export const listCategoriesSchema = z.strictObject({
  search: z.string().trim().max(50).optional(),
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;
