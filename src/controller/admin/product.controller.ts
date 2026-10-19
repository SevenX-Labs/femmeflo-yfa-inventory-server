import type { Request, Response } from "express";
import type { AdminProductService } from "../../services/admin/product.service.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import { createProductSchema, listProductsSchema, updateProductSchema } from "../product.validation.js";

export function createAdminProductController(service: AdminProductService) {
  return {
    list: async (request: Request, response: Response) => {
      const query = parseInput(listProductsSchema, request.query);
      const result = await service.list(query);
      response.json({ success: true, message: "Products retrieved", data: result });
    },

    create: async (request: Request, response: Response) => {
      const input = parseInput(createProductSchema, request.body);
      const product = await service.create(input);
      response.status(201).json({ success: true, message: "Product created", data: { product } });
    },

    getById: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const product = await service.getById(id);
      response.json({ success: true, message: "Product retrieved", data: { product } });
    },

    update: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const input = parseInput(updateProductSchema, request.body);
      const product = await service.update(id, input);
      response.json({ success: true, message: "Product updated", data: { product } });
    },

    toggleActive: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const product = await service.toggleActive(id);
      response.json({ success: true, message: `Product ${product.active ? "activated" : "deactivated"}`, data: { product } });
    },
  };
}
