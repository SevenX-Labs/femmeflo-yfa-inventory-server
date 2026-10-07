import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManagerController } from "../../controller/admin/manager.controller.js";
import { createAdminPermissionController } from "../../controller/admin/permission.controller.js";
import { createManagerService } from "../../services/admin/manager.service.js";
import { createAdminPermissionService } from "../../services/admin/permission.service.js";

export function createManagerRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createManagerController(createManagerService(database));
  const permController = createAdminPermissionController(createAdminPermissionService(database));
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);
  router.patch("/:id/permissions", permController.updateManagerPermissions);
  return router;
}

