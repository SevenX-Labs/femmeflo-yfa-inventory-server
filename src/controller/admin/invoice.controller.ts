import type { Request, Response } from "express";
import type { AdminInvoiceService } from "../../services/admin/invoice.service.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import { z } from "zod";

const listInvoicesSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export function createAdminInvoiceController(service: AdminInvoiceService) {
  return {
    list: async (request: Request, response: Response) => {
      const query = parseInput(listInvoicesSchema, request.query);
      const result = await service.list(query);
      response.json({
        success: true,
        message: "Invoices retrieved",
        data: { ...result, invoices: result.items },
      });
    },

    get: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const invoice = await service.get(id);
      response.json({
        success: true,
        message: "Invoice details retrieved",
        data: { invoice },
      });
    },
  };
}
