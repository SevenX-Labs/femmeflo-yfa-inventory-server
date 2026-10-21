import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminShiftController } from "../../controller/admin/shift.controller.js";
import { createShiftService } from "../../services/shift.service.js";

export function createAdminShiftRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminShiftController(createShiftService(database));

  router.get("/", controller.list);
  router.get("/:id", controller.get);

  return router;
}
