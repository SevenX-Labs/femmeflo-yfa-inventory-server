import type { Request, Response } from "express";
import type { ShiftService } from "../../services/shift.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, idSchema, HttpError } from "../../middleware/validation.js";
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

    endShift: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const shift = await service.getShiftById(id);
      if (!shift) {
        throw new HttpError(404, "Shift not found");
      }
      if (shift.status !== "ACTIVE") {
        throw new HttpError(400, "Shift is already completed");
      }
      const visits = shift.visits || [];
      const lastVisit = visits.length > 0 ? visits[visits.length - 1] : undefined;
      const endLat = lastVisit ? lastVisit.latitude : shift.startLatitude;
      const endLng = lastVisit ? lastVisit.longitude : shift.startLongitude;
      const completed = await service.endShift(shift.sellerId, {
        latitude: endLat,
        longitude: endLng,
        address: shift.startAddress || "Completed by Admin",
        faceVerified: true,
        notes: "Shift concluded by administrator",
      });
      response.json({
        success: true,
        message: "Active shift successfully ended",
        data: { shift: completed },
      });
    },
  };
}
