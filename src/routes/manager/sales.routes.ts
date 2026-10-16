import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerSalesController } from "../../controller/manager/sales.controller.js";
import { createManagerSalesService } from "../../services/manager/sales.service.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";

export function createManagerSalesRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerSalesController(createManagerSalesService(database));

  router.get("/", requirePermission("approve_sales"), controller.list);
  router.get("/:id", requirePermission("approve_sales"), controller.get);

  return router;
}
