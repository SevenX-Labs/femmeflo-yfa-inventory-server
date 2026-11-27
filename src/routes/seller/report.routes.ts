import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSellerReportController } from "../../controller/seller/report.controller.js";
import { createSellerReportService } from "../../services/seller/report.service.js";

export function createSellerReportRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createSellerReportController(createSellerReportService(database));

  router.get("/", controller.getReport);

  return router;
}
