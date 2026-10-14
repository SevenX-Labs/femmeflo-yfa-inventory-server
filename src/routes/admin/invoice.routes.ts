import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminInvoiceController } from "../../controller/admin/invoice.controller.js";
import { createAdminInvoiceService } from "../../services/admin/invoice.service.js";

export function createAdminInvoiceRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminInvoiceController(createAdminInvoiceService(database));

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.get("/:id/pdf", controller.getPdf);

  return router;
}
