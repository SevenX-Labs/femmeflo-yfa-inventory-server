import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { AuthService } from "../services/auth/auth.service.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import { createManagerRoutes } from "./admin/manager.routes.js";
import { createAdminSellerRoutes } from "./admin/seller.routes.js";
import { createManagerSellerRoutes } from "./manager/seller.routes.js";
import { createCategoryRoutes } from "./category.routes.js";
import { createAdminCustomerRoutes } from "./admin/customer.routes.js";
import { createManagerCustomerRoutes } from "./manager/customer.routes.js";
import { createSellerCustomerRoutes } from "./seller/customer.routes.js";

export function createUserRoutes(database: PrismaClient, auth: AuthService) {
  const router = Router();
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  const authenticate = requireAuthentication(auth);

  // Categories
  router.use("/categories", authenticate, createCategoryRoutes(database));
  router.use("/admin/categories", authenticate, requireRole("SUPER_ADMIN"), createCategoryRoutes(database));

  // Admin routes
  router.use("/admin/managers", authenticate, requireRole("SUPER_ADMIN"), createManagerRoutes(database));
  router.use("/admin/sellers", authenticate, requireRole("SUPER_ADMIN"), createAdminSellerRoutes(database));
  router.use("/admin/customers", authenticate, requireRole("SUPER_ADMIN"), createAdminCustomerRoutes(database));

  // Manager routes
  router.use("/manager/sellers", authenticate, requireRole("MANAGER"), createManagerSellerRoutes(database));
  router.use("/manager/customers", authenticate, requireRole("MANAGER"), createManagerCustomerRoutes(database));

  // Seller routes
  router.use("/seller/customers", authenticate, requireRole("SELLER"), createSellerCustomerRoutes(database));

  return router;
}
