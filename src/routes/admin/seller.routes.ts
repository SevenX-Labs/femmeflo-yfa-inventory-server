import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminSellerController } from "../../controller/admin/seller.controller.js";
import { createAdminSellerService } from "../../services/admin/seller.service.js";

export function createAdminSellerRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminSellerController(createAdminSellerService(database));
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);
  return router;
}
