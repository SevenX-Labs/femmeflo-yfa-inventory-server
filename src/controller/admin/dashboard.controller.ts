import type { Request, Response } from "express";
import type { AdminDashboardService } from "../../services/admin/dashboard.service.js";
import { parseInput } from "../../middleware/validation.js";
import { dashboardFilterSchema } from "../dashboard.validation.js";

export function createAdminDashboardController(service: AdminDashboardService) {
  return {
    getDashboard: async (request: Request, response: Response) => {
      const filters = parseInput(dashboardFilterSchema, request.query);
      const data = await service.getDashboard(filters);
      response.json({
        success: true,
        message: "Super Admin dashboard retrieved",
        data,
      });
    },

    getFilters: async (_request: Request, response: Response) => {
      const data = await service.getFilters();
      response.json({
        success: true,
        message: "Filter options retrieved",
        data,
      });
    },
  };
}
