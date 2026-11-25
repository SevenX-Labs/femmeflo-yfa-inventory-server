import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerSalesController } from "../../controller/manager/sales.controller.js";
import { createManagerSalesService } from "../../services/manager/sales.service.js";
import { requireAnyPermission, requirePermission } from "../../middleware/rbac.middleware.js";

export function createManagerSalesRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerSalesController(createManagerSalesService(database));

  router.get("/", requireAnyPermission(["approve_sales", "SALES_READ", "view_reports", "view_sellers", "SELLER_READ"]), controller.list);
  router.get("/:id", requireAnyPermission(["approve_sales", "SALES_READ", "view_reports", "view_sellers", "SELLER_READ"]), controller.get);
  router.patch("/:id", requirePermission("approve_sales"), controller.update);

  return router;
}
