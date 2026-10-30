import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createCustomerController } from "../../controller/customer.controller.js";
import { createCustomerService } from "../../services/customer.service.js";
import { uploadCustomerPhotoMiddleware } from "../../middleware/upload.middleware.js";
import { uploadRateLimiter } from "../../middleware/rate-limit.middleware.js";
import { requirePermission, requireAnyPermission } from "../../middleware/rbac.middleware.js";

export function createManagerCustomerRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createCustomerController(createCustomerService(database));

  router.get("/pincode/:pincode", controller.lookupPincode);
  router.get("/", requireAnyPermission(["view_customers", "CUSTOMER_READ", "SELLER_READ", "onboard_customers", "CUSTOMER_CREATE"]), controller.list);
  router.post("/bulk", requirePermission("onboard_customers"), controller.createBulk);
  router.post("/", requirePermission("onboard_customers"), uploadCustomerPhotoMiddleware, controller.create);
  router.get("/:id", requireAnyPermission(["view_customers", "CUSTOMER_READ", "SELLER_READ", "onboard_customers", "CUSTOMER_CREATE"]), controller.get);
  router.patch("/:id", requirePermission("onboard_customers"), uploadCustomerPhotoMiddleware, controller.update);
  router.post("/:id/photo", requirePermission("onboard_customers"), uploadRateLimiter, uploadCustomerPhotoMiddleware, controller.uploadPhoto);

  return router;
}
