import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSellerSalesController } from "../../controller/seller/sales.controller.js";
import { createSellerSalesService } from "../../services/seller/sales.service.js";

export function createSellerSalesRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createSellerSalesController(createSellerSalesService(database));

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.patch("/:id/payment", controller.collectPayment);

  return router;
}
