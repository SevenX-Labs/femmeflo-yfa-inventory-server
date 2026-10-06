import type { Request, Response } from "express";
import type { ManagerDashboardService } from "../../services/manager/dashboard.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";

export function createManagerDashboardController(service: ManagerDashboardService) {
  return {
    getDashboard: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const data = await service.getDashboard(user);
      response.json({
        success: true,
        message: "Manager dashboard retrieved",
        data,
      });
    },
  };
}
