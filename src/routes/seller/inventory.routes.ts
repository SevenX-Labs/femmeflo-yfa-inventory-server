import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSellerInventoryController } from "../../controller/seller/inventory.controller.js";
import { createSellerInventoryService } from "../../services/seller/inventory.service.js";

export function createSellerInventoryRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createSellerInventoryController(createSellerInventoryService(database));

  router.get("/", controller.getInventory);
  router.get("/transactions", controller.listTransactions);

  return router;
}
