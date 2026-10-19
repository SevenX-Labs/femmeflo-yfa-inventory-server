import type { PrismaClient } from "../generated/prisma/client.js";
import type { CreateCategoryInput, ListCategoriesInput, UpdateCategoryInput } from "../controller/category.validation.js";
import { HttpError } from "../middleware/validation.js";

export function createCategoryService(database: PrismaClient) {
  return {
    list: async (query: ListCategoriesInput) => {
      const where: Record<string, unknown> = {};
      if (query.active !== undefined) where["active"] = query.active;
      if (query.search) {
        where["name"] = { contains: query.search, mode: "insensitive" };
      }
      return database.category.findMany({
        where,
        orderBy: { name: "asc" },
      });
    },

    create: async (input: CreateCategoryInput) => {
      const existing = await database.category.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" } },
      });
      if (existing) {
        throw new HttpError(409, "Category with this name already exists");
      }
      return database.category.create({
        data: { name: input.name },
      });
    },

    get: async (id: string) => {
      const category = await database.category.findUnique({ where: { id } });
      if (!category) {
        throw new HttpError(404, "Category not found");
      }
      return category;
    },

    update: async (id: string, input: UpdateCategoryInput) => {
      const category = await database.category.findUnique({ where: { id } });
      if (!category) {
        throw new HttpError(404, "Category not found");
      }
      if (input.name && input.name.toLowerCase() !== category.name.toLowerCase()) {
        const existing = await database.category.findFirst({
          where: { name: { equals: input.name, mode: "insensitive" }, id: { not: id } },
        });
        if (existing) {
          throw new HttpError(409, "Category with this name already exists");
        }
      }
      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data["name"] = input.name;
      if (input.active !== undefined) data["active"] = input.active;
      return database.category.update({
        where: { id },
        data,
      });
    },

    delete: async (id: string) => {
      const category = await database.category.findUnique({
        where: { id },
        include: { _count: { select: { customers: true } } },
      });

      if (!category) {
        throw new HttpError(404, "Category not found");
      }

      if (category._count.customers > 0) {
        // If linked to customers, perform a clean soft-delete (deactivate) so existing customers keep their integrity
        // while the category is removed from active options and the category manager
        await database.category.update({
          where: { id },
          data: { active: false },
        });
        return { id, name: category.name, deactivated: true };
      }

      await database.category.delete({
        where: { id },
      });

      return { id, name: category.name };
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
