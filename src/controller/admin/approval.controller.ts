import type { Request, Response } from "express";
import type { AdminApprovalService } from "../../services/admin/approval.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import { listSalesSchema, rejectSaleSchema } from "../sales.validation.js";

export function createAdminApprovalController(service: AdminApprovalService) {
  return {
    listPending: async (request: Request, response: Response) => {
      const query = parseInput(listSalesSchema, request.query);
      const result = await service.listPending(query);
      response.json({
        success: true,
        message: "Pending sale approval requests retrieved",
        data: { ...result, pendingSales: result.items },
      });
    },

    approve: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const saleId = parseInput(idSchema, request.params["saleId"]);
      const sale = await service.approve(user.id, saleId);
      response.json({
        success: true,
        message: "Sale approved and confirmed successfully",
        data: { sale },
      });
    },

    reject: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const saleId = parseInput(idSchema, request.params["saleId"]);
      const input = parseInput(rejectSaleSchema, request.body ?? {});
      const sale = await service.reject(user.id, saleId, input);
      response.json({
        success: true,
        message: "Sale rejected",
        data: { sale },
      });
    },
  };
}
