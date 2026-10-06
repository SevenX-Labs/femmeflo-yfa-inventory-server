import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerSalesController } from "../../controller/manager/sales.controller.js";
import { createManagerSalesService } from "../../services/manager/sales.service.js";

export function createManagerSalesRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerSalesController(createManagerSalesService(database));

  router.get("/", controller.list);
  router.get("/:id", controller.get);

  return router;
}
