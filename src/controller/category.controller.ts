import type { Request, Response } from "express";
import type { CategoryService } from "../services/category.service.js";
import { parseInput, idSchema } from "../middleware/validation.js";
import { createCategorySchema, listCategoriesSchema, updateCategorySchema } from "./category.validation.js";

export function createCategoryController(service: CategoryService) {
  return {
    list: async (request: Request, response: Response) => {
      const query = parseInput(listCategoriesSchema, request.query);
      const categories = await service.list(query);
      response.json({
        success: true,
        message: "Categories retrieved",
        data: { items: categories, categories },
      });
    },

    create: async (request: Request, response: Response) => {
      const input = parseInput(createCategorySchema, request.body);
      const category = await service.create(input);
      response.status(201).json({
        success: true,
        message: "Category created",
        data: { category },
      });
    },

    get: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const category = await service.get(id);
      response.json({
        success: true,
        message: "Category retrieved",
        data: { category },
      });
    },

    update: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const input = parseInput(updateCategorySchema, request.body);
      const category = await service.update(id, input);
      response.json({
        success: true,
        message: "Category updated",
        data: { category },
      });
    },
  };
}
