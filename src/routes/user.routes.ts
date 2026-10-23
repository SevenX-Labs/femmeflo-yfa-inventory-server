import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { AuthService } from "../services/auth/auth.service.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import { parseInput, idSchema } from "../middleware/validation.js";
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
import { createManagerIncentiveRoutes } from "./manager/incentive.routes.js";
import { createSellerDashboardRoutes } from "./seller/dashboard.routes.js";
import { createManagerDashboardRoutes } from "./manager/dashboard.routes.js";
import { createAdminDashboardRoutes } from "./admin/dashboard.routes.js";
import { createAdminInvoiceRoutes } from "./admin/invoice.routes.js";
import { createAdminPermissionRoutes } from "./admin/permission.routes.js";
import { createAdminReportRoutes } from "./admin/report.routes.js";
import { createSellerProfileRoutes } from "./seller/profile.routes.js";
import { createSellerShiftRoutes } from "./seller/shift.routes.js";
import { createAdminShiftRoutes } from "./admin/shift.routes.js";
import { createGeoRoutes } from "./geo.routes.js";
import { createAdminProductRoutes } from "./admin/product.routes.js";
import { createProductListRoutes } from "./product.routes.js";
import { generateInvoicePdfBuffer, type InvoiceSnapshot } from "../services/pdf.service.js";
import { getCachedBusinessSettings } from "../services/settings.cache.js";

export function createUserRoutes(database: PrismaClient, auth: AuthService) {
  const router = Router();
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  const authenticate = requireAuthentication(auth);

  // Invoices (Direct PDF streaming for Admin, Manager, and Seller)
  router.get("/invoices/:id/pdf", authenticate, async (request, response, next) => {
    try {
      const user = response.locals.authUser as { id: string; role: string };
      const id = parseInput(idSchema, request.params["id"]);
      const invoice = await database.invoice.findUnique({
        where: { id },
        include: {
          sale: {
            include: {
              customer: true,
              seller: { select: { id: true, name: true, phone: true, managerId: true } },
            },
          },
        },
      });

      if (!invoice) {
        response.status(404).json({ success: false, message: "Invoice not found" });
        return;
      }

      // Role authorization
      if (user.role === "SELLER" && invoice.sale.sellerId !== user.id) {
        response.status(403).json({ success: false, message: "Forbidden" });
        return;
      }
      if (user.role === "MANAGER" && invoice.sale.seller.managerId !== user.id) {
        response.status(403).json({ success: false, message: "Forbidden" });
        return;
      }

      let snapshot = invoice.snapshot as unknown as InvoiceSnapshot;
      if (!snapshot || !snapshot.invoiceNumber) {
        snapshot = {
          invoiceNumber: invoice.number,
          saleId: invoice.saleId,
          date: invoice.createdAt.toISOString(),
          customer: {
            shopName: invoice.sale?.customer?.shopName || "Customer Store",
            contactName: invoice.sale?.customer?.contactName || "Customer",
            phone: invoice.sale?.customer?.phone || "",
            state: invoice.sale?.customer?.state,
            district: invoice.sale?.customer?.district,
            village: invoice.sale?.customer?.village,
          },
          seller: {
            name: invoice.sale?.seller?.name || "Seller",
            phone: invoice.sale?.seller?.phone || "",
          },
          quantity: invoice.sale?.quantity || 0,
          unitPricePaise: invoice.sale?.unitPricePaise || 0,
          totalPaise: invoice.sale?.totalPaise || 0,
          paymentMode: invoice.sale?.paymentMode || "CASH",
        };
      }

      // Real-time update: always overlay latest BusinessSettings configured in admin
      const s = await getCachedBusinessSettings(database);
      if (s) {
        snapshot = {
          ...snapshot,
          company: {
            name: s.companyName || snapshot.company?.name || "MASAKO ENTERPRISES PRIVATE LIMITED",
            gst: s.companyGst || snapshot.company?.gst,
            pan: s.companyPan || snapshot.company?.pan,
            address: s.companyAddress || snapshot.company?.address,
            phone: s.companyPhone || snapshot.company?.phone,
            email: s.companyEmail || snapshot.company?.email,
            terms: s.invoiceTerms || snapshot.company?.terms,
          },
        };
      }
      const pdfBuffer = await generateInvoicePdfBuffer(snapshot);
      const isDownload = request.query["download"] === "true";

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="Invoice-${invoice.number}.pdf"`
      );
      response.setHeader("Content-Length", pdfBuffer.length);
      response.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  });

  // Geocoding
  router.use("/geo", authenticate, createGeoRoutes());

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
  router.use("/admin/permissions", authenticate, requireRole("SUPER_ADMIN"), createAdminPermissionRoutes(database));
  router.use("/admin/reports", authenticate, requireRole("SUPER_ADMIN"), createAdminReportRoutes(database));
  router.use("/admin/products", authenticate, requireRole("SUPER_ADMIN"), createAdminProductRoutes(database));
  router.use("/admin/shifts", authenticate, requireRole("SUPER_ADMIN"), createAdminShiftRoutes(database));

  // Manager routes
  router.use("/manager/products", authenticate, requireRole("MANAGER"), createProductListRoutes(database));
  router.use("/manager/sellers", authenticate, requireRole("MANAGER"), createManagerSellerRoutes(database));
  router.use("/manager/customers", authenticate, requireRole("MANAGER"), createManagerCustomerRoutes(database));
  router.use("/manager/inventory", authenticate, requireRole("MANAGER"), createManagerInventoryRoutes(database));
  router.use("/manager/sales", authenticate, requireRole("MANAGER"), createManagerSalesRoutes(database));
  router.use("/manager/dashboard", authenticate, requireRole("MANAGER"), createManagerDashboardRoutes(database));
  router.use("/manager/incentives", authenticate, requireRole("MANAGER"), createManagerIncentiveRoutes(database));
  router.use("/manager/shifts", authenticate, requireRole("MANAGER"), createAdminShiftRoutes(database));

  // Seller routes
  router.use("/seller/products", authenticate, requireRole("SELLER", "MANAGER"), createProductListRoutes(database));
  router.use("/seller/customers", authenticate, requireRole("SELLER", "MANAGER"), createSellerCustomerRoutes(database));
  router.use("/seller/inventory", authenticate, requireRole("SELLER", "MANAGER"), createSellerInventoryRoutes(database));
  router.use("/seller/sales", authenticate, requireRole("SELLER", "MANAGER"), createSellerSalesRoutes(database));
  router.use("/seller/incentives", authenticate, requireRole("SELLER", "MANAGER"), createSellerIncentiveRoutes(database));
  router.use("/seller/dashboard", authenticate, requireRole("SELLER", "MANAGER"), createSellerDashboardRoutes(database));
  router.use("/seller/profile", authenticate, requireRole("SELLER", "MANAGER"), createSellerProfileRoutes(database));
  router.use("/seller/shifts", authenticate, requireRole("SELLER", "MANAGER"), createSellerShiftRoutes(database));

  return router;
}

