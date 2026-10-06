import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSellerDashboardController } from "../../controller/seller/dashboard.controller.js";
import { createSellerDashboardService } from "../../services/seller/dashboard.service.js";

export function createSellerDashboardRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createSellerDashboardController(createSellerDashboardService(database));

  router.get("/", controller.getDashboard);

  return router;
}
