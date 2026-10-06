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
import { createAdminInventoryRoutes } from "./admin/inventory.routes.js";
import { createManagerInventoryRoutes } from "./manager/inventory.routes.js";
import { createSellerInventoryRoutes } from "./seller/inventory.routes.js";
import { createSellerSalesRoutes } from "./seller/sales.routes.js";
import { createAdminSalesRoutes } from "./admin/sales.routes.js";
import { createAdminApprovalRoutes } from "./admin/approval.routes.js";
import { createManagerSalesRoutes } from "./manager/sales.routes.js";
import { createAdminIncentiveRoutes } from "./admin/incentive.routes.js";
import { createSellerIncentiveRoutes } from "./seller/incentive.routes.js";
import { createSellerDashboardRoutes } from "./seller/dashboard.routes.js";
import { createManagerDashboardRoutes } from "./manager/dashboard.routes.js";
import { createAdminDashboardRoutes } from "./admin/dashboard.routes.js";
import { createAdminInvoiceRoutes } from "./admin/invoice.routes.js";

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
  router.use("/admin/inventory", authenticate, requireRole("SUPER_ADMIN"), createAdminInventoryRoutes(database));
  router.use("/admin/sales", authenticate, requireRole("SUPER_ADMIN"), createAdminSalesRoutes(database));
  router.use("/admin/approvals", authenticate, requireRole("SUPER_ADMIN"), createAdminApprovalRoutes(database));
  router.use("/admin/incentives", authenticate, requireRole("SUPER_ADMIN"), createAdminIncentiveRoutes(database));
  router.use("/admin/dashboard", authenticate, requireRole("SUPER_ADMIN"), createAdminDashboardRoutes(database));
  router.use("/admin/invoices", authenticate, requireRole("SUPER_ADMIN"), createAdminInvoiceRoutes(database));

  // Manager routes
  router.use("/manager/sellers", authenticate, requireRole("MANAGER"), createManagerSellerRoutes(database));
  router.use("/manager/customers", authenticate, requireRole("MANAGER"), createManagerCustomerRoutes(database));
  router.use("/manager/inventory", authenticate, requireRole("MANAGER"), createManagerInventoryRoutes(database));
  router.use("/manager/sales", authenticate, requireRole("MANAGER"), createManagerSalesRoutes(database));
  router.use("/manager/dashboard", authenticate, requireRole("MANAGER"), createManagerDashboardRoutes(database));

  // Seller routes
  router.use("/seller/customers", authenticate, requireRole("SELLER"), createSellerCustomerRoutes(database));
  router.use("/seller/inventory", authenticate, requireRole("SELLER"), createSellerInventoryRoutes(database));
  router.use("/seller/sales", authenticate, requireRole("SELLER"), createSellerSalesRoutes(database));
  router.use("/seller/incentives", authenticate, requireRole("SELLER"), createSellerIncentiveRoutes(database));
  router.use("/seller/dashboard", authenticate, requireRole("SELLER"), createSellerDashboardRoutes(database));

  return router;
}
