import type { Request, Response } from "express";
import type { ManagerIncentiveService } from "../../services/manager/incentive.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";

export function createManagerIncentiveController(service: ManagerIncentiveService) {
  return {
    getIncentives: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const data = await service.getIncentives(user);
      response.json({
        success: true,
        message: "Manager incentive reports retrieved",
        data,
      });
    },
  };
}
