import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { DashboardFilterInput } from "../../controller/dashboard.validation.js";

export function createAdminDashboardService(database: PrismaClient) {
  return {
    getDashboard: async (filters: DashboardFilterInput) => {
      // Build filters for sales
      const salesWhere: Prisma.SaleWhereInput = { status: "CONFIRMED" };

      if (filters.sellerId) salesWhere.sellerId = filters.sellerId;

      const customerWhere: Prisma.CustomerWhereInput = {};
      if (filters.state) customerWhere.state = { equals: filters.state, mode: "insensitive" };
      if (filters.district) customerWhere.district = { equals: filters.district, mode: "insensitive" };
      if (filters.village) customerWhere.village = { equals: filters.village, mode: "insensitive" };
      if (filters.categoryId) customerWhere.categoryId = filters.categoryId;
      if (filters.managerId) customerWhere.seller = { managerId: filters.managerId };

      if (Object.keys(customerWhere).length > 0) {
        salesWhere.customer = customerWhere;
      }

      // Sales metrics
      const salesAggregate = await database.sale.aggregate({
        _sum: { quantity: true, totalPaise: true, incentiveAmountPaise: true },
        where: salesWhere,
      });

      const totalPacketsSold = salesAggregate._sum.quantity ?? 0;
      const totalEarningsPaise = salesAggregate._sum.totalPaise ?? 0;
      const totalIncentivePaise = salesAggregate._sum.incentiveAmountPaise ?? 0;

      // Entity counts
      const userWhere: Prisma.UserWhereInput = {};
      if (filters.state) userWhere.state = { equals: filters.state, mode: "insensitive" };
      if (filters.district) userWhere.district = { equals: filters.district, mode: "insensitive" };
      if (filters.village) userWhere.village = { equals: filters.village, mode: "insensitive" };

      const totalManagers = await database.user.count({ where: { ...userWhere, role: "MANAGER", active: true } });
      const totalSellers = await database.user.count({ where: { ...userWhere, role: "SELLER", active: true } });
      const totalShops = await database.customer.count({ where: { ...customerWhere, active: true } });

      // Unique states count
      const distinctStatesResult = await database.customer.groupBy({
        by: ["state"],
        where: { active: true },
      });
      const totalStates = distinctStatesResult.length;

      // Total Inventory across HQ, Warehouses, Sellers
      const locations = await database.stockLocation.findMany();
      let totalInventory = 0;
      let hqStock = 0;
      let warehouseStock = 0;
      let sellerStock = 0;

      for (const loc of locations) {
        totalInventory += loc.balance;
        if (loc.type === "HQ") hqStock += loc.balance;
        if (loc.type === "WAREHOUSE") warehouseStock += loc.balance;
        if (loc.type === "SELLER") sellerStock += loc.balance;
      }

      return {
        metrics: {
          totalPacketsSold,
          totalEarningsPaise,
          totalEarningsRupees: totalEarningsPaise / 100,
          totalStates,
          totalShops,
          totalManagers,
          totalSellers,
          totalInventory,
          hqStock,
          warehouseStock,
          sellerStock,
          totalIncentivePaise,
          totalIncentiveRupees: totalIncentivePaise / 100,
        },
        appliedFilters: filters,
      };
    },

    getFilters: async () => {
      // Helper endpoint returning distinct states, districts, and categories for UI dropdowns
      const categories = await database.category.findMany({ where: { active: true }, select: { id: true, name: true } });
      const statesResult = await database.customer.groupBy({ by: ["state"] });
      const districtsResult = await database.customer.groupBy({ by: ["district"] });

      return {
        categories,
        states: statesResult.map((r) => r.state),
        districts: districtsResult.map((r) => r.district),
      };
    },
  };
}

export type AdminDashboardService = ReturnType<typeof createAdminDashboardService>;
