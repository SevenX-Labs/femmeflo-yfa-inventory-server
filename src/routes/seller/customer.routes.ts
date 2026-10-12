import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createCustomerController } from "../../controller/customer.controller.js";
import { createCustomerService } from "../../services/customer.service.js";
import { uploadCustomerPhotoMiddleware } from "../../middleware/upload.middleware.js";

export function createSellerCustomerRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createCustomerController(createCustomerService(database));

  router.get("/", controller.list);
  router.post("/", uploadCustomerPhotoMiddleware, controller.create);
  router.get("/:id", controller.get);
  router.patch("/:id", uploadCustomerPhotoMiddleware, controller.update);
  router.post("/:id/photo", uploadCustomerPhotoMiddleware, controller.uploadPhoto);

  return router;
}
