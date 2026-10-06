import type { Request, Response } from "express";
import type { SellerDashboardService } from "../../services/seller/dashboard.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";

export function createSellerDashboardController(service: SellerDashboardService) {
  return {
    getDashboard: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const data = await service.getDashboard(user.id);
      response.json({
        success: true,
        message: "Seller dashboard retrieved",
        data,
      });
    },
  };
}
