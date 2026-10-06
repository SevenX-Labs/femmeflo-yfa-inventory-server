import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminDashboardController } from "../../controller/admin/dashboard.controller.js";
import { createAdminDashboardService } from "../../services/admin/dashboard.service.js";

export function createAdminDashboardRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminDashboardController(createAdminDashboardService(database));

  router.get("/", controller.getDashboard);
  router.get("/filters", controller.getFilters);

  return router;
}
