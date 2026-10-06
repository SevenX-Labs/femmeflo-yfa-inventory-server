import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createCustomerController } from "../../controller/customer.controller.js";
import { createCustomerService } from "../../services/customer.service.js";

export function createSellerCustomerRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createCustomerController(createCustomerService(database));

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);

  return router;
}
