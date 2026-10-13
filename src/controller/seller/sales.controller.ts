import type { Request, Response } from "express";
import type { SellerSalesService } from "../../services/seller/sales.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import { createSaleSchema, listSalesSchema } from "../sales.validation.js";
import { collectPaymentSchema } from "../payment.validation.js";

export function createSellerSalesController(service: SellerSalesService) {
  return {
    create: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(createSaleSchema, request.body);
      const sale = await service.create(user.id, input);
      response.status(201).json({
        success: true,
        message: sale.status === "PENDING_APPROVAL" ? "Sale recorded and sent for low-price approval" : "Sale confirmed successfully",
        data: { sale },
      });
    },

    list: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const query = parseInput(listSalesSchema, request.query);
      const result = await service.list(user.id, query);
      response.json({
        success: true,
        message: "Sales history retrieved",
        data: { ...result, sales: result.items },
      });
    },

    get: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const sale = await service.get(user.id, id);
      response.json({
        success: true,
        message: "Sale details retrieved",
        data: { sale },
      });
    },

    collectPayment: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const input = parseInput(collectPaymentSchema, request.body);
      const result = await service.collectPayment(user.id, id, input.mode);
      response.json({
        success: true,
        message: "Pending payment collected successfully",
        data: result,
      });
    },
  };
}
