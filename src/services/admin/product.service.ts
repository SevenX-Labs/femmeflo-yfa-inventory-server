import type { PrismaClient } from "../../generated/prisma/client.js";
import type { CreateProductInput, UpdateProductInput, ListProductsInput } from "../../controller/product.validation.js";
import { HttpError } from "../../middleware/validation.js";
import { invalidateProductsCache } from "../../routes/product.routes.js";

export function createAdminProductService(database: PrismaClient) {
  return {
    list: async (query: ListProductsInput) => {
      const where: Record<string, unknown> = {};
      if (query.active !== undefined) where["active"] = query.active === "true";
      if (query.search) {
        where["OR"] = [
          { name: { contains: query.search, mode: "insensitive" } },
          { sku: { contains: query.search, mode: "insensitive" } },
        ];
      }

      const total = await database.product.count({ where });
      const totalPages = Math.ceil(total / query.pageSize);
      const items = await database.product.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ active: "desc" }, { name: "asc" }],
      });

      return {
        items,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: totalPages === 0 && total === 0 ? 0 : Math.max(1, totalPages),
        },
      };
    },

    create: async (input: CreateProductInput) => {
      const existing = await database.product.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" } },
      });
      if (existing) {
        throw new HttpError(409, "Product with this name already exists");
      }

      if (input.sku) {
        const skuExists = await database.product.findUnique({ where: { sku: input.sku } });
        if (skuExists) {
          throw new HttpError(409, "Product with this SKU already exists");
        }
      }

      invalidateProductsCache();
      return database.product.create({
        data: {
          name: input.name,
          sku: input.sku ?? null,
          basePricePaise: input.basePricePaise,
          minimumPricePaise: input.minimumPricePaise,
          active: input.active,
        },
      });
    },

    getById: async (id: string) => {
      const product = await database.product.findUnique({ where: { id } });
      if (!product) {
        throw new HttpError(404, "Product not found");
      }
      return product;
    },

    update: async (id: string, input: UpdateProductInput) => {
      const product = await database.product.findUnique({ where: { id } });
      if (!product) {
        throw new HttpError(404, "Product not found");
      }

      if (input.name && input.name.toLowerCase() !== product.name.toLowerCase()) {
        const existing = await database.product.findFirst({
          where: { name: { equals: input.name, mode: "insensitive" }, id: { not: id } },
        });
        if (existing) {
          throw new HttpError(409, "Product with this name already exists");
        }
      }

      if (input.sku !== undefined && input.sku !== null && input.sku !== product.sku) {
        const skuExists = await database.product.findFirst({
          where: { sku: input.sku, id: { not: id } },
        });
        if (skuExists) {
          throw new HttpError(409, "Product with this SKU already exists");
        }
      }

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data["name"] = input.name;
      if (input.sku !== undefined) data["sku"] = input.sku;
      if (input.basePricePaise !== undefined) data["basePricePaise"] = input.basePricePaise;
      if (input.minimumPricePaise !== undefined) data["minimumPricePaise"] = input.minimumPricePaise;
      if (input.active !== undefined) data["active"] = input.active;

      invalidateProductsCache();
      return database.product.update({ where: { id }, data });
    },

    toggleActive: async (id: string) => {
      const product = await database.product.findUnique({ where: { id } });
      if (!product) {
        throw new HttpError(404, "Product not found");
      }
      invalidateProductsCache();
      return database.product.update({
        where: { id },
        data: { active: !product.active },
      });
    },
  };
}

export type AdminProductService = ReturnType<typeof createAdminProductService>;
