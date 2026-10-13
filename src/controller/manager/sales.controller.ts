import type { Request, Response } from "express";
import type { ManagerSalesService } from "../../services/manager/sales.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import { listSalesSchema } from "../sales.validation.js";

export function createManagerSalesController(service: ManagerSalesService) {
  return {
    list: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const query = parseInput(listSalesSchema, request.query);
      const result = await service.list(user, query);
      response.json({
        success: true,
        message: "Assigned sales records retrieved",
        data: { ...result, sales: result.items },
      });
    },

    get: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const sale = await service.get(user, id);
      response.json({
        success: true,
        message: "Sale details retrieved",
        data: { sale },
      });
    },
  };
}
