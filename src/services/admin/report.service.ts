import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { SalesReportQueryInput, InventoryReportQueryInput } from "../../controller/report.validation.js";
import { parseISTDateRange } from "../../utils/timezone.utils.js";

export function createAdminReportService(database: PrismaClient) {
  return {
    getSalesReport: async (query: SalesReportQueryInput) => {
      const where: Prisma.SaleWhereInput = {};

      if (query.status) {
        where.status = query.status;
      } else {
        where.status = "CONFIRMED";
      }

      if (query.paymentMode) where.paymentMode = query.paymentMode;
      if (query.sellerId) where.sellerId = query.sellerId;

      const dateRange = parseISTDateRange(query.from, query.to);
      if (dateRange) where.createdAt = dateRange;

      const customerWhere: Prisma.CustomerWhereInput = {};
      if (query.state) customerWhere.state = { equals: query.state, mode: "insensitive" };
      if (query.district) customerWhere.district = { equals: query.district, mode: "insensitive" };
      if (query.village) customerWhere.village = { equals: query.village, mode: "insensitive" };
      if (query.managerId) customerWhere.seller = { managerId: query.managerId };

      if (Object.keys(customerWhere).length > 0) {
        where.customer = customerWhere;
      }

      const limit = query.format === "json" ? 500 : 5000;
      const [aggregate, sales] = await Promise.all([
        database.sale.aggregate({
          where,
          _count: { id: true },
          _sum: { quantity: true, totalPaise: true },
        }),
        database.sale.findMany({
          where,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            quantity: true,
            unitPricePaise: true,
            totalPaise: true,
            paymentMode: true,
            status: true,
            sellerId: true,
            customer: { select: { id: true, shopName: true, contactName: true, state: true, district: true, village: true } },
            seller: { select: { id: true, name: true, phone: true, manager: { select: { id: true, name: true } } } },
          },
        }),
      ]);

      const totalSalesCount = aggregate._count.id ?? 0;
      const totalQuantitySold = aggregate._sum.quantity ?? 0;
      const grossSalesPaise = aggregate._sum.totalPaise ?? 0;
      const grossSalesRupees = grossSalesPaise / 100;
      const averageOrderValueRupees = totalSalesCount > 0 ? grossSalesRupees / totalSalesCount : 0;

      // Grouping if requested
      const groups: Record<string, { label: string; count: number; quantity: number; totalPaise: number }> = {};
      if (query.groupBy) {
        for (const sale of sales) {
          let key = "Unknown";
          if (query.groupBy === "date") key = sale.createdAt.toISOString().split("T")[0]!;
          else if (query.groupBy === "seller") key = sale.seller?.name || sale.sellerId;
          else if (query.groupBy === "manager") key = sale.seller?.manager?.name || "Unassigned";
          else if (query.groupBy === "state") key = sale.customer.state;
          else if (query.groupBy === "district") key = sale.customer.district;
          else if (query.groupBy === "village") key = sale.customer.village;

          if (!groups[key]) {
            groups[key] = { label: key, count: 0, quantity: 0, totalPaise: 0 };
          }
          groups[key]!.count += 1;
          groups[key]!.quantity += sale.quantity;
          groups[key]!.totalPaise += sale.totalPaise;
        }
      }

      return {
        summary: {
          totalSalesCount,
          totalQuantitySold,
          grossSalesPaise,
          grossSalesRupees,
          netSalesPaise: grossSalesPaise,
          netSalesRupees: grossSalesRupees,
          averageOrderValueRupees,
        },
        groups: query.groupBy ? Object.values(groups) : undefined,
        items: sales,
      };
    },

    getInventoryReport: async (query: InventoryReportQueryInput) => {
      const dateRange = parseISTDateRange(query.from, query.to);

      // Fetch stock locations
      const locationWhere: Prisma.StockLocationWhereInput = {};
      if (query.locationId) locationWhere.id = query.locationId;
      if (query.type) locationWhere.type = query.type;

      const locations = await database.stockLocation.findMany({
        where: locationWhere,
        include: {
          seller: { select: { id: true, name: true, phone: true, manager: { select: { id: true, name: true } } } },
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });

      let totalStock = 0;
      let hqStock = 0;
      let warehouseStock = 0;
      let sellerStock = 0;

      for (const loc of locations) {
        totalStock += loc.balance;
        if (loc.type === "HQ") hqStock += loc.balance;
        if (loc.type === "WAREHOUSE") warehouseStock += loc.balance;
        if (loc.type === "SELLER") sellerStock += loc.balance;
      }

      // Movements aggregation using DB groupBy query
      const movementWhere: Prisma.StockMovementWhereInput = {};
      if (dateRange) movementWhere.createdAt = dateRange;
      if (query.locationId) {
        movementWhere.OR = [{ sourceId: query.locationId }, { destinationId: query.locationId }];
      }

      const limit = query.format === "json" ? 500 : 5000;
      const [movementSummary, movements] = await Promise.all([
        database.stockMovement.groupBy({
          by: ["type"],
          where: movementWhere,
          _sum: { quantity: true },
        }),
        database.stockMovement.findMany({
          where: movementWhere,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            source: { select: { id: true, name: true, type: true } },
            destination: { select: { id: true, name: true, type: true } },
            actor: { select: { id: true, name: true, role: true } },
          },
        }),
      ]);

      let totalReceived = 0;
      let totalTransferred = 0;
      let totalSold = 0;

      for (const item of movementSummary) {
        if (item.type === "RECEIPT") totalReceived = item._sum.quantity ?? 0;
        if (item.type === "TRANSFER") totalTransferred = item._sum.quantity ?? 0;
        if (item.type === "SALE") totalSold = item._sum.quantity ?? 0;
      }

      return {
        summary: {
          totalStock,
          hqStock,
          warehouseStock,
          sellerStock,
          totalReceived,
          totalTransferred,
          totalSold,
        },
        locations,
        movements,
      };
    },
  };
}

export type AdminReportService = ReturnType<typeof createAdminReportService>;
