import type { Request, Response } from "express";
import type { ShiftService } from "../../services/shift.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import { listShiftsQuerySchema } from "../shift.validation.js";

export function createAdminShiftController(service: ShiftService) {
  return {
    list: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const query = parseInput(listShiftsQuerySchema, request.query);
      const managerScope = user.role === "MANAGER" ? user.id : undefined;
      const result = await service.listAllShifts(query, managerScope);
      response.json({
        success: true,
        message: "Shifts retrieved",
        data: { ...result, shifts: result.items },
      });
    },

    get: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const shift = await service.getShiftById(id);
      response.json({
        success: true,
        message: "Shift details retrieved",
        data: { shift },
      });
    },
  };
}
