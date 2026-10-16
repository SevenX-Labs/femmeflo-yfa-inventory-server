import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerInventoryController } from "../../controller/manager/inventory.controller.js";
import { createManagerInventoryService } from "../../services/manager/inventory.service.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";

export function createManagerInventoryRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerInventoryController(createManagerInventoryService(database));

  router.get("/", requirePermission("view_inventory"), controller.getInventory);

  return router;
}
