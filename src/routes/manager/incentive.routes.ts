import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerIncentiveController } from "../../controller/manager/incentive.controller.js";
import { createManagerIncentiveService } from "../../services/manager/incentive.service.js";

export function createManagerIncentiveRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerIncentiveController(createManagerIncentiveService(database));

  router.get("/", controller.getIncentives);

  return router;
}
