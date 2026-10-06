import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { ListSalesInput } from "../../controller/sales.validation.js";
import { HttpError } from "../../middleware/validation.js";
import { getPeriodDateRange } from "../seller/sales.service.js";

export function createAdminSalesService(database: PrismaClient) {
  return {
    list: async (query: ListSalesInput) => {
      const where: Prisma.SaleWhereInput = {};

      if (query.status) where.status = query.status;
      if (query.paymentMode) where.paymentMode = query.paymentMode;
      if (query.sellerId) where.sellerId = query.sellerId;
      if (query.customerId) where.customerId = query.customerId;

      const dateRange = getPeriodDateRange(query.period);
      if (dateRange) where.createdAt = dateRange;

      if (query.search) {
        where.OR = [
          { customer: { shopName: { contains: query.search, mode: "insensitive" } } },
          { customer: { contactName: { contains: query.search, mode: "insensitive" } } },
          { seller: { name: { contains: query.search, mode: "insensitive" } } },
        ];
      }

      const total = await database.sale.count({ where });
      const totalPages = Math.ceil(total / query.pageSize);
      const items = await database.sale.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
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

    get: async (id: string) => {
      const sale = await database.sale.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
          seller: { select: { id: true, name: true, phone: true, email: true } },
          invoice: true,
          payments: true,
          decidedBy: { select: { id: true, name: true } },
        },
      });

      if (!sale) {
        throw new HttpError(404, "Sale record not found");
      }
      return sale;
    },
  };
}

export type AdminSalesService = ReturnType<typeof createAdminSalesService>;
