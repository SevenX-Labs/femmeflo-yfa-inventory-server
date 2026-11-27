import type { Request, Response } from "express";
import { parseInput } from "../../middleware/validation.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import type { SellerReportService } from "../../services/seller/report.service.js";
import { sellerReportQuerySchema } from "../report.validation.js";

export function createSellerReportController(service: SellerReportService) {
  return {
    getReport: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const query = parseInput(sellerReportQuerySchema, request.query);
      const data = await service.getReport(user.id, query);
      response.json({
        success: true,
        message: "Seller report retrieved",
        data,
      });
    },
  };
}
