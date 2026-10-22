import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSellerShiftController } from "../../controller/seller/shift.controller.js";
import { createShiftService } from "../../services/shift.service.js";

export function createSellerShiftRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createSellerShiftController(createShiftService(database));

  router.post("/start", controller.start);
  router.get("/current", controller.current);
  router.post("/check-in", controller.checkIn);
  router.post("/check-out", controller.checkOut);
  router.post("/end", controller.end);
  router.get("/history", controller.history);

  return router;
}
