import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerSellerController } from "../../controller/manager/seller.controller.js";
import { createManagerSellerService } from "../../services/manager/seller.service.js";
import { requirePermission } from "../../middleware/rbac.middleware.js";

export function createManagerSellerRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerSellerController(createManagerSellerService(database));
  router.get("/", requirePermission("SELLER_READ"), controller.list);
  router.post("/", requirePermission("SELLER_CREATE"), controller.create);
  router.get("/:id", requirePermission("SELLER_READ"), controller.get);
  return router;
}
