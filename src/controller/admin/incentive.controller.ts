import type { Request, Response } from "express";
import type { AdminIncentiveService } from "../../services/admin/incentive.service.js";
import { parseInput } from "../../middleware/validation.js";
import { updateIncentiveSettingsSchema } from "../incentive.validation.js";

export function createAdminIncentiveController(service: AdminIncentiveService) {
  return {
    getIncentives: async (_request: Request, response: Response) => {
      const data = await service.getIncentives();
      response.json({
        success: true,
        message: "Incentive reports retrieved",
        data,
      });
    },

    getSettings: async (_request: Request, response: Response) => {
      const settings = await service.getSettings();
      response.json({
        success: true,
        message: "Business settings retrieved",
        data: { settings },
      });
    },

    updateSettings: async (request: Request, response: Response) => {
      const input = parseInput(updateIncentiveSettingsSchema, request.body);
      const settings = await service.updateSettings(input);
      response.json({
        success: true,
        message: "Business settings updated",
        data: { settings },
      });
    },
  };
}
