import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSellerProfileController } from "../../controller/seller/profile.controller.js";
import { createSellerProfileService } from "../../services/seller/profile.service.js";

export function createSellerProfileRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createSellerProfileController(createSellerProfileService(database));

  router.get("/", controller.getProfile);
  router.patch("/", controller.updateProfile);

  return router;
}
