import type { Request, Response } from "express";
import type { ManagerInventoryService } from "../../services/manager/inventory.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";

export function createManagerInventoryController(service: ManagerInventoryService) {
  return {
    getInventory: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const data = await service.getInventory(user);
      response.json({
        success: true,
        message: "Assigned inventory summary retrieved",
        data,
      });
    },
  };
}
