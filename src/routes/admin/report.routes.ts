import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminReportController } from "../../controller/admin/report.controller.js";
import { createAdminReportService } from "../../services/admin/report.service.js";
import { reportExportRateLimiter } from "../../middleware/rate-limit.middleware.js";

export function createAdminReportRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminReportController(createAdminReportService(database));

  router.get("/sales", reportExportRateLimiter, controller.getSalesReport);
  router.get("/inventory", reportExportRateLimiter, controller.getInventoryReport);

  return router;
}
