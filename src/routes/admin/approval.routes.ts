import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminApprovalController } from "../../controller/admin/approval.controller.js";
import { createAdminApprovalService } from "../../services/admin/approval.service.js";

export function createAdminApprovalRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminApprovalController(createAdminApprovalService(database));

  router.get("/", controller.listPending);
  router.post("/:saleId/approve", controller.approve);
  router.post("/:saleId/reject", controller.reject);

  return router;
}
