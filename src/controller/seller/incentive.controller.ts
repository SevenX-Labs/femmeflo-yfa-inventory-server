import type { Request, Response } from "express";
import type { SellerIncentiveService } from "../../services/seller/incentive.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";

export function createSellerIncentiveController(service: SellerIncentiveService) {
  return {
    getIncentives: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const data = await service.getIncentives(user.id);
      response.json({
        success: true,
        message: "Incentives retrieved",
        data,
      });
    },
  };
}
