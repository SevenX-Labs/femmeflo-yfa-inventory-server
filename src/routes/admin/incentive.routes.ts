import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminIncentiveController } from "../../controller/admin/incentive.controller.js";
import { createAdminIncentiveService } from "../../services/admin/incentive.service.js";

export function createAdminIncentiveRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminIncentiveController(createAdminIncentiveService(database));

  router.get("/", controller.getIncentives);
  router.get("/settings", controller.getSettings);
  router.patch("/settings", controller.updateSettings);

  router.get("/users/:id", controller.getUserIncentiveDetails);
  router.patch("/users/:id/rate", controller.updateUserRate);
  router.post("/users/:id/adjustments", controller.createAdjustment);
  router.post("/users/:id/payouts", controller.createPayout);

  return router;
}
