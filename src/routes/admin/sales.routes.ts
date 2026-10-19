import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminSalesController } from "../../controller/admin/sales.controller.js";
import { createAdminSalesService } from "../../services/admin/sales.service.js";

export function createAdminSalesRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminSalesController(createAdminSalesService(database));

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);

  return router;
}
