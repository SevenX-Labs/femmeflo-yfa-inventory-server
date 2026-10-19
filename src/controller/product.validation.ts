import { z } from "zod";

export const createProductSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(50).optional(),
  basePricePaise: z.coerce.number().int().positive(),
  minimumPricePaise: z.coerce.number().int().positive(),
  active: z.boolean().optional().default(true),
});

export const updateProductSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().max(50).nullable().optional(),
  basePricePaise: z.coerce.number().int().positive().optional(),
  minimumPricePaise: z.coerce.number().int().positive().optional(),
  active: z.boolean().optional(),
});

export const listProductsSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  active: z.enum(["true", "false"]).optional(),
  search: z.string().trim().max(100).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
