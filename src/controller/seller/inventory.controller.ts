import type { Request, Response } from "express";
import type { SellerInventoryService } from "../../services/seller/inventory.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput } from "../../middleware/validation.js";
import { listTransactionsSchema } from "../inventory.validation.js";

export function createSellerInventoryController(service: SellerInventoryService) {
  return {
    getInventory: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const data = await service.getInventory(user.id);
      response.json({
        success: true,
        message: "Inventory retrieved",
        data,
      });
    },

    listTransactions: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const query = parseInput(listTransactionsSchema, request.query);
      const data = await service.listTransactions(user.id, query);
      response.json({
        success: true,
        message: "Transactions retrieved",
        data: { ...data, transactions: data.items },
      });
    },
  };
}
