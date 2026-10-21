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

      const userWhere: Prisma.UserWhereInput = {};
      if (filters.state) userWhere.state = { equals: filters.state, mode: "insensitive" };
      if (filters.district) userWhere.district = { equals: filters.district, mode: "insensitive" };
      if (filters.village) userWhere.village = { equals: filters.village, mode: "insensitive" };

      const [salesAggregate, totalManagers, totalSellers, totalShops, distinctStatesResult, locations] = await Promise.all([
        database.sale.aggregate({
          _sum: { quantity: true, totalPaise: true, incentiveAmountPaise: true },
          where: salesWhere,
        }),
        database.user.count({ where: { ...userWhere, role: "MANAGER", active: true } }),
        database.user.count({ where: { ...userWhere, role: "SELLER", active: true } }),
        database.customer.count({ where: { ...customerWhere, active: true } }),
        database.customer.groupBy({
          by: ["state"],
          where: { active: true },
        }),
        database.stockLocation.findMany(),
      ]);

      const totalPacketsSold = salesAggregate._sum.quantity ?? 0;
      const totalEarningsPaise = salesAggregate._sum.totalPaise ?? 0;
      const totalIncentivePaise = salesAggregate._sum.incentiveAmountPaise ?? 0;
      const totalStates = distinctStatesResult.length;

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
      // Helper endpoint returning distinct states, districts, villages, managers, sellers, and categories
      const [categories, customerLocations, managers, sellers] = await Promise.all([
        database.category.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        database.customer.findMany({
          where: { active: true },
          select: { state: true, district: true, village: true },
          distinct: ["state", "district", "village"],
        }),
        database.user.findMany({
          where: { role: "MANAGER", active: true },
          select: { id: true, name: true, state: true, district: true },
          orderBy: { name: "asc" },
        }),
        database.user.findMany({
          where: { role: "SELLER", active: true },
          select: { id: true, name: true, managerId: true, state: true, district: true },
          orderBy: { name: "asc" },
        }),
      ]);

      const statesSet = new Set<string>();
      const districtsList: Array<{ state: string; district: string }> = [];
      const villagesList: Array<{ state: string; district: string; village: string }> = [];
      const districtKeySet = new Set<string>();
      const villageKeySet = new Set<string>();

      for (const loc of customerLocations) {
        if (loc.state) statesSet.add(loc.state);
        if (loc.state && loc.district) {
          const dKey = `${loc.state}:::${loc.district}`;
          if (!districtKeySet.has(dKey)) {
            districtKeySet.add(dKey);
            districtsList.push({ state: loc.state, district: loc.district });
          }
        }
        if (loc.state && loc.district && loc.village) {
          const vKey = `${loc.state}:::${loc.district}:::${loc.village}`;
          if (!villageKeySet.has(vKey)) {
            villageKeySet.add(vKey);
            villagesList.push({ state: loc.state, district: loc.district, village: loc.village });
          }
        }
      }

      const rawDistricts = Array.from(new Set(districtsList.map((d) => d.district))).sort();

      return {
        categories,
        states: Array.from(statesSet).sort(),
        districts: districtsList,
        rawDistricts,
        villages: villagesList,
        managers,
        sellers,
      };
    },
  };
}

export type AdminDashboardService = ReturnType<typeof createAdminDashboardService>;
