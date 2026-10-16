import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminPermissionController } from "../../controller/admin/permission.controller.js";
import { createAdminPermissionService } from "../../services/admin/permission.service.js";

export function createAdminPermissionRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminPermissionController(createAdminPermissionService(database));

  router.get("/", controller.list);
  router.patch("/overall", controller.updateOverallPermissions);
  router.patch("/managers/all/permissions", controller.updateOverallPermissions);
  router.patch("/managers/:id/permissions", controller.updateManagerPermissions);

  return router;
}
