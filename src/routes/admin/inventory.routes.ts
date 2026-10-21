import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAdminInventoryController } from "../../controller/admin/inventory.controller.js";
import { createAdminInventoryService } from "../../services/admin/inventory.service.js";

export function createAdminInventoryRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createAdminInventoryController(createAdminInventoryService(database));

  router.get("/", controller.getSummary);
  router.post("/warehouses", controller.createWarehouse);
  router.get("/warehouses", controller.listWarehouses);
  router.delete("/warehouses/:id", controller.deleteWarehouse);
  router.post("/receipts", controller.addReceipt);
  router.post("/transfers", con troller.transfer);
  router.patch("/locations/:id/balance", controller.updateLocationBalance);
  router.get("/transactions", controller.listTransactions);

  return router;
}
