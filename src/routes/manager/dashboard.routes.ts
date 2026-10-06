import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerDashboardController } from "../../controller/manager/dashboard.controller.js";
import { createManagerDashboardService } from "../../services/manager/dashboard.service.js";

export function createManagerDashboardRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerDashboardController(createManagerDashboardService(database));

  router.get("/", controller.getDashboard);

  return router;
}
