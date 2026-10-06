import type { PrismaClient } from "../../generated/prisma/client.js";
import { HttpError } from "../../middleware/validation.js";

export function createAdminInvoiceService(database: PrismaClient) {
  return {
    list: async (query: { page: number; pageSize: number; search?: string | undefined }) => {
      const page = query.page;
      const pageSize = query.pageSize;

      const where: Record<string, unknown> = {};
      if (query.search) {
        where["OR"] = [
          { number: { contains: query.search, mode: "insensitive" } },
          { sale: { customer: { shopName: { contains: query.search, mode: "insensitive" } } } },
        ];
      }

      const total = await database.invoice.count({ where });
      const totalPages = Math.ceil(total / pageSize);
      const items = await database.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          sale: {
            select: {
              id: true,
              quantity: true,
              totalPaise: true,
              paymentMode: true,
              customer: { select: { id: true, shopName: true, contactName: true } },
              seller: { select: { id: true, name: true } },
            },
          },
        },
      });

      return {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: totalPages === 0 && total === 0 ? 0 : Math.max(1, totalPages),
        },
      };
    },

    get: async (id: string) => {
      const invoice = await database.invoice.findUnique({
        where: { id },
        include: {
          sale: {
            include: {
              customer: true,
              seller: { select: { id: true, name: true, phone: true, email: true } },
              payments: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new HttpError(404, "Invoice not found");
      }
      return invoice;
    },
  };
}

export type AdminInvoiceService = ReturnType<typeof createAdminInvoiceService>;
