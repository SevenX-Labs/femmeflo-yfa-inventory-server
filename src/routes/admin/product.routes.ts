import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminProductController } from "../../controller/admin/product.controller.js";
import { createAdminProductService } from "../../services/admin/product.service.js";

export function createAdminProductRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminProductController(createAdminProductService(database));

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.getById);
  router.patch("/:id", controller.update);
  router.patch("/:id/toggle", controller.toggleActive);

  return router;
}
