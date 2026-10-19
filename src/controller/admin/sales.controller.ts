import type { Request, Response } from "express";
import type { AdminSalesService } from "../../services/admin/sales.service.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import { listSalesSchema, updateSaleSchema } from "../sales.validation.js";
import type { PublicUser } from "../../services/auth/auth.types.js";

export function createAdminSalesController(service: AdminSalesService) {
  return {
    list: async (request: Request, response: Response) => {
      const query = parseInput(listSalesSchema, request.query);
      const result = await service.list(query);
      response.json({
        success: true,
        message: "Sales records retrieved",
        data: { ...result, sales: result.items },
      });
    },

    update: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const input = parseInput(updateSaleSchema, request.body);
      const sale = await service.update(user.id, id, input);
      response.json({
        success: true,
        message: "Sale details updated successfully by Admin",
        data: { sale },
      });
    },

    get: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const sale = await service.get(id);
      response.json({
        success: true,
        message: "Sale details retrieved",
        data: { sale },
      });
    },
  };
}
