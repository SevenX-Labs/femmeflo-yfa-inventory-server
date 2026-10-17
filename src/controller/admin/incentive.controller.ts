import type { Request, Response } from "express";
import type { AdminIncentiveService } from "../../services/admin/incentive.service.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import {
  updateIncentiveSettingsSchema,
  updateUserRateSchema,
  createAdjustmentSchema,
  createPayoutSchema,
  listIncentivesQuerySchema,
} from "../incentive.validation.js";
import type { PublicUser } from "../../services/auth/auth.types.js";

export function createAdminIncentiveController(service: AdminIncentiveService) {
  return {
    getIncentives: async (request: Request, response: Response) => {
      const query = parseInput(listIncentivesQuerySchema, request.query);
      const data = await service.getIncentives(query);
      response.json({
        success: true,
        message: "Incentive reports retrieved",
        data,
      });
    },

    getUserIncentiveDetails: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const data = await service.getUserIncentiveDetails(id);
      response.json({
        success: true,
        message: "Employee incentive details retrieved",
        data,
      });
    },

    updateUserRate: async (request: Request, response: Response) => {
      const admin = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const input = parseInput(updateUserRateSchema, request.body);
      const data = await service.updateUserRate(admin.id, id, input);
      response.json({
        success: true,
        message: "Incentive rate updated successfully",
        data,
      });
    },

    createAdjustment: async (request: Request, response: Response) => {
      const admin = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const input = parseInput(createAdjustmentSchema, request.body);
      const data = await service.createAdjustment(admin.id, id, input);
      response.status(201).json({
        success: true,
        message: `Incentive adjustment (${input.type}) recorded successfully`,
        data: { adjustment: data },
      });
    },

    createPayout: async (request: Request, response: Response) => {
      const admin = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const input = parseInput(createPayoutSchema, request.body);
      const data = await service.createPayout(admin.id, id, input);
      response.status(201).json({
        success: true,
        message: "Incentive payout recorded successfully",
        data: { payout: data },
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
