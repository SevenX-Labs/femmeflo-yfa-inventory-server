import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSellerIncentiveController } from "../../controller/seller/incentive.controller.js";
import { createSellerIncentiveService } from "../../services/seller/incentive.service.js";

export function createSellerIncentiveRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createSellerIncentiveController(createSellerIncentiveService(database));

  router.get("/", controller.getIncentives);

  return router;
}
