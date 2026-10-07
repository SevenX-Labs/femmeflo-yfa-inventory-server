import type { Request, Response } from "express";
import type { AdminReportService } from "../../services/admin/report.service.js";
import { parseInput } from "../../middleware/validation.js";
import { salesReportQuerySchema, inventoryReportQuerySchema } from "../report.validation.js";
import { arrayToCsv, createExcelWorkbookBuffer } from "../../utils/export.utils.js";

export function createAdminReportController(service: AdminReportService) {
  return {
    getSalesReport: async (request: Request, response: Response) => {
      const query = parseInput(salesReportQuerySchema, request.query);
      const report = await service.getSalesReport(query);


      if (query.format === "csv") {
        const headers = ["Sale ID", "Date", "Shop Name", "Contact Name", "State", "District", "Village", "Seller", "Manager", "Quantity", "Unit Price (₹)", "Total Amount (₹)", "Payment Mode", "Status"];
        const rows = report.items.map((sale) => [
          sale.id,
          sale.createdAt.toISOString(),
          sale.customer.shopName,
          sale.customer.contactName,
          sale.customer.state,
          sale.customer.district,
          sale.customer.village,
          sale.seller.name,
          sale.seller.manager?.name || "",
          sale.quantity,
          (sale.unitPricePaise / 100).toFixed(2),
          (sale.totalPaise / 100).toFixed(2),
          sale.paymentMode,
          sale.status,
        ]);
        const csvText = arrayToCsv(headers, rows);
        response.setHeader("Content-Type", "text/csv");
        response.setHeader("Content-Disposition", 'attachment; filename="sales-report.csv"');
        response.send(csvText);
        return;
      }

      if (query.format === "xlsx") {
        const columns = [
          { header: "Sale ID", key: "id", width: 36 },
          { header: "Date", key: "date", width: 22 },
          { header: "Shop Name", key: "shopName", width: 25 },
          { header: "Contact Name", key: "contactName", width: 20 },
          { header: "State", key: "state", width: 15 },
          { header: "District", key: "district", width: 15 },
          { header: "Village", key: "village", width: 15 },
          { header: "Seller Name", key: "sellerName", width: 20 },
          { header: "Manager Name", key: "managerName", width: 20 },
          { header: "Quantity", key: "quantity", width: 12 },
          { header: "Unit Price (₹)", key: "unitPrice", width: 15 },
          { header: "Total Amount (₹)", key: "totalAmount", width: 18 },
          { header: "Payment Mode", key: "paymentMode", width: 15 },
          { header: "Status", key: "status", width: 18 },
        ];
        const rows = report.items.map((sale) => ({
          id: sale.id,
          date: sale.createdAt.toISOString(),
          shopName: sale.customer.shopName,
          contactName: sale.customer.contactName,
          state: sale.customer.state,
          district: sale.customer.district,
          village: sale.customer.village,
          sellerName: sale.seller.name,
          managerName: sale.seller.manager?.name || "",
          quantity: sale.quantity,
          unitPrice: (sale.unitPricePaise / 100).toFixed(2),
          totalAmount: (sale.totalPaise / 100).toFixed(2),
          paymentMode: sale.paymentMode,
          status: sale.status,
        }));
        const buffer = await createExcelWorkbookBuffer("Sales Report", columns, rows);
        response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", 'attachment; filename="sales-report.xlsx"');
        response.send(buffer);
        return;
      }

      response.json({
        success: true,
        data: report,
      });
    },

    getInventoryReport: async (request: Request, response: Response) => {
      const query = parseInput(inventoryReportQuerySchema, request.query);
      const report = await service.getInventoryReport(query);


      if (query.format === "csv") {
        const headers = ["Location ID", "Type", "Name", "Seller Name", "Manager Name", "Balance"];
        const rows = report.locations.map((loc) => [
          loc.id,
          loc.type,
          loc.name,
          loc.seller?.name || "",
          loc.seller?.manager?.name || "",
          loc.balance,
        ]);
        const csvText = arrayToCsv(headers, rows);
        response.setHeader("Content-Type", "text/csv");
        response.setHeader("Content-Disposition", 'attachment; filename="inventory-report.csv"');
        response.send(csvText);
        return;
      }

      if (query.format === "xlsx") {
        const columns = [
          { header: "Location ID", key: "id", width: 36 },
          { header: "Type", key: "type", width: 15 },
          { header: "Location Name", key: "name", width: 25 },
          { header: "Seller Name", key: "sellerName", width: 20 },
          { header: "Manager Name", key: "managerName", width: 20 },
          { header: "Balance", key: "balance", width: 15 },
        ];
        const rows = report.locations.map((loc) => ({
          id: loc.id,
          type: loc.type,
          name: loc.name,
          sellerName: loc.seller?.name || "",
          managerName: loc.seller?.manager?.name || "",
          balance: loc.balance,
        }));
        const buffer = await createExcelWorkbookBuffer("Inventory Report", columns, rows);
        response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", 'attachment; filename="inventory-report.xlsx"');
        response.send(buffer);
        return;
      }

      response.json({
        success: true,
        data: report,
      });
    },
  };
}
