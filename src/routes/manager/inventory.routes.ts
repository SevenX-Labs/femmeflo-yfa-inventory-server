import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerInventoryController } from "../../controller/manager/inventory.controller.js";
import { createManagerInventoryService } from "../../services/manager/inventory.service.js";

export function createManagerInventoryRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerInventoryController(createManagerInventoryService(database));

  router.get("/", controller.getInventory);

  return router;
}
