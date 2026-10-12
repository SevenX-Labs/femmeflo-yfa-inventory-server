import type { Request, Response } from "express";
import type { AdminReportService } from "../../services/admin/report.service.js";
import { parseInput } from "../../middleware/validation.js";
import { salesReportQuerySchema, inventoryReportQuerySchema } from "../report.validation.js";
import { arrayToCsv, createExcelWorkbookBuffer, type ColumnDefinition } from "../../utils/export.utils.js";
import { formatISTDate } from "../../utils/timezone.utils.js";

export function createAdminReportController(service: AdminReportService) {
  return {
    getSalesReport: async (request: Request, response: Response) => {
      const query = parseInput(salesReportQuerySchema, request.query);
      const report = await service.getSalesReport(query);

      if (query.format === "csv") {
        const headers = ["Sale ID", "Date (IST)", "Shop Name", "Contact Name", "State", "District", "Village", "Seller", "Manager", "Quantity", "Unit Price (₹)", "Total Amount (₹)", "Payment Mode", "Status"];
        const rows: (string | number)[][] = report.items.map((sale) => [
          sale.id,
          formatISTDate(new Date(sale.createdAt)),
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

        if (report.items.length > 0) {
          rows.push([
            "TOTAL",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            report.summary.totalQuantitySold,
            "",
            report.summary.grossSalesRupees.toFixed(2),
            "",
            "",
          ]);
        }

        const csvText = arrayToCsv(headers, rows);
        response.setHeader("Content-Type", "text/csv; charset=utf-8");
        response.setHeader("Content-Disposition", 'attachment; filename="sales-report.csv"');
        response.send(csvText);
        return;
      }

      if (query.format === "xlsx") {
        const columns: ColumnDefinition[] = [
          { header: "Sale ID", key: "id", width: 36 },
          { header: "Date (IST)", key: "date", width: 22 },
          { header: "Shop Name", key: "shopName", width: 25 },
          { header: "Contact Name", key: "contactName", width: 20 },
          { header: "State", key: "state", width: 15 },
          { header: "District", key: "district", width: 15 },
          { header: "Village", key: "village", width: 15 },
          { header: "Seller Name", key: "sellerName", width: 20 },
          { header: "Manager Name", key: "managerName", width: 20 },
          { header: "Quantity", key: "quantity", width: 14, isNumber: true },
          { header: "Unit Price (₹)", key: "unitPrice", width: 16, isCurrency: true },
          { header: "Total Amount (₹)", key: "totalAmount", width: 18, isCurrency: true },
          { header: "Payment Mode", key: "paymentMode", width: 15 },
          { header: "Status", key: "status", width: 18 },
        ];
        const rows = report.items.map((sale) => ({
          id: sale.id,
          date: formatISTDate(new Date(sale.createdAt)),
          shopName: sale.customer.shopName,
          contactName: sale.customer.contactName,
          state: sale.customer.state,
          district: sale.customer.district,
          village: sale.customer.village,
          sellerName: sale.seller.name,
          managerName: sale.seller.manager?.name || "",
          quantity: sale.quantity,
          unitPrice: sale.unitPricePaise / 100,
          totalAmount: sale.totalPaise / 100,
          paymentMode: sale.paymentMode,
          status: sale.status,
        }));

        const summary = {
          labelColumnKey: "sellerName",
          totals: {
            quantity: report.summary.totalQuantitySold,
            totalAmount: report.summary.grossSalesRupees,
          },
        };

        const buffer = await createExcelWorkbookBuffer("Sales Report", columns, rows, summary);
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
        const rows: (string | number)[][] = report.locations.map((loc) => [
          loc.id,
          loc.type,
          loc.name,
          loc.seller?.name || "",
          loc.seller?.manager?.name || "",
          loc.balance,
        ]);

        if (report.locations.length > 0) {
          rows.push(["TOTAL", "", "", "", "", report.summary.totalStock]);
        }

        const csvText = arrayToCsv(headers, rows);
        response.setHeader("Content-Type", "text/csv; charset=utf-8");
        response.setHeader("Content-Disposition", 'attachment; filename="inventory-report.csv"');
        response.send(csvText);
        return;
      }

      if (query.format === "xlsx") {
        const columns: ColumnDefinition[] = [
          { header: "Location ID", key: "id", width: 36 },
          { header: "Type", key: "type", width: 15 },
          { header: "Location Name", key: "name", width: 25 },
          { header: "Seller Name", key: "sellerName", width: 20 },
          { header: "Manager Name", key: "managerName", width: 20 },
          { header: "Balance", key: "balance", width: 16, isNumber: true },
        ];
        const rows = report.locations.map((loc) => ({
          id: loc.id,
          type: loc.type,
          name: loc.name,
          sellerName: loc.seller?.name || "",
          managerName: loc.seller?.manager?.name || "",
          balance: loc.balance,
        }));

        const summary = {
          labelColumnKey: "name",
          totals: {
            balance: report.summary.totalStock,
          },
        };

        const buffer = await createExcelWorkbookBuffer("Inventory Report", columns, rows, summary);
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
