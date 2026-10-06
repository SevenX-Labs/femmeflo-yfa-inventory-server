import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { ListSalesInput } from "../../controller/sales.validation.js";
import type { PublicUser } from "../auth/auth.types.js";
import { HttpError } from "../../middleware/validation.js";
import { getPeriodDateRange } from "../seller/sales.service.js";

export function createManagerSalesService(database: PrismaClient) {
  return {
    list: async (manager: PublicUser, query: ListSalesInput) => {
      const where: Prisma.SaleWhereInput = {
        seller: { managerId: manager.id },
      };

      if (query.status) where.status = query.status;
      if (query.paymentMode) where.paymentMode = query.paymentMode;
      if (query.sellerId) where.sellerId = query.sellerId;
      if (query.customerId) where.customerId = query.customerId;

      const dateRange = getPeriodDateRange(query.period);
      if (dateRange) where.createdAt = dateRange;

      if (query.search) {
        where.customer = {
          OR: [
            { shopName: { contains: query.search, mode: "insensitive" } },
            { contactName: { contains: query.search, mode: "insensitive" } },
          ],
        };
      }

      const total = await database.sale.count({ where });
      const totalPages = Math.ceil(total / query.pageSize);
      const items = await database.sale.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
          seller: { select: { id: true, name: true, phone: true } },
          invoice: { select: { id: true, number: true } },
        },
      });

      return {
        items,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: totalPages === 0 && total === 0 ? 0 : Math.max(1, totalPages),
        },
      };
    },

    get: async (manager: PublicUser, id: string) => {
      const sale = await database.sale.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
          seller: { select: { id: true, name: true, phone: true, managerId: true } },
          invoice: true,
          payments: true,
        },
      });

      if (!sale || sale.seller.managerId !== manager.id) {
        throw new HttpError(404, "Sale record not found or outside assigned scope");
      }
      return sale;
    },
  };
}

export type ManagerSalesService = ReturnType<typeof createManagerSalesService>;
