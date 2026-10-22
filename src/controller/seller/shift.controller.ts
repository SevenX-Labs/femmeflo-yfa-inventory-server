import type { Request, Response } from "express";
import type { ShiftService } from "../../services/shift.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput } from "../../middleware/validation.js";
import {
  startShiftSchema,
  checkInSchema,
  checkOutSchema,
  endShiftSchema,
  listShiftsQuerySchema,
} from "../shift.validation.js";

export function createSellerShiftController(service: ShiftService) {
  return {
    start: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(startShiftSchema, request.body);
      const shift = await service.startShift(user.id, input);
      response.status(201).json({
        success: true,
        message: "Shift started",
        data: { shift },
      });
    },

    current: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const shift = await service.getCurrentShift(user.id);
      response.json({
        success: true,
        message: shift ? "Current shift retrieved" : "No active shift",
        data: { shift },
      });
    },

    checkIn: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(checkInSchema, request.body);
      const visit = await service.checkIn(user.id, input);
      response.status(201).json({
        success: true,
        message: "Shop visit recorded",
        data: { visit },
      });
    },

    checkOut: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(checkOutSchema, request.body);
      const visit = await service.checkOut(user.id, input);
      response.json({
        success: true,
        message: `Checked out. Duration: ${visit.durationMins} mins`,
        data: { visit },
      });
    },

    end: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(endShiftSchema, request.body);
      const shift = await service.endShift(user.id, input);
      response.json({
        success: true,
        message: `Shift completed. Total distance: ${shift.totalDistanceKm} km`,
        data: { shift },
      });
    },

    history: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const query = parseInput(listShiftsQuerySchema, request.query);
      const result = await service.listSellerShifts(user.id, query);
      response.json({
        success: true,
        message: "Shift history retrieved",
        data: { ...result, shifts: result.items },
      });
    },
  };
}
