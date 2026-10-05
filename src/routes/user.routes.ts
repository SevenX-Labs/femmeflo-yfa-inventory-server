import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { AuthService } from "../services/auth/auth.service.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import { createManagerRoutes } from "./admin/manager.routes.js";
import { createAdminSellerRoutes } from "./admin/seller.routes.js";
import { createManagerSellerRoutes } from "./manager/seller.routes.js";

export function createUserRoutes(database: PrismaClient, auth: AuthService) {
  const router = Router();
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  const authenticate = requireAuthentication(auth);
  router.use("/admin/managers", authenticate, requireRole("SUPER_ADMIN"), createManagerRoutes(database));
  router.use("/admin/sellers", authenticate, requireRole("SUPER_ADMIN"), createAdminSellerRoutes(database));
  router.use("/manager/sellers", authenticate, requireRole("MANAGER"), createManagerSellerRoutes(database));
  return router;
}
