import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminReportController } from "../../controller/admin/report.controller.js";
import { createAdminReportService } from "../../services/admin/report.service.js";

export function createAdminReportRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminReportController(createAdminReportService(database));

  router.get("/sales", controller.getSalesReport);
  router.get("/inventory", controller.getInventoryReport);

  return router;
}
