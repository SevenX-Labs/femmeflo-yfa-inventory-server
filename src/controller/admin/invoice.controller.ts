import type { Request, Response } from "express";
import type { AdminInvoiceService } from "../../services/admin/invoice.service.js";
import { parseInput, idSchema } from "../../middleware/validation.js";
import { generateInvoicePdfBuffer, type InvoiceSnapshot } from "../../services/pdf.service.js";
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

    getPdf: async (request: Request, response: Response) => {
      const id = parseInput(idSchema, request.params["id"]);
      const invoice = await service.get(id);

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

      if (!snapshot.company || !snapshot.company.gst) {
        const s = await (service as any).getSettings?.();
        if (s) {
          snapshot = {
            ...snapshot,
            company: {
              name: s.companyName,
              gst: s.companyGst,
              pan: s.companyPan,
              address: s.companyAddress,
              phone: s.companyPhone,
              email: s.companyEmail,
              terms: s.invoiceTerms,
            },
          };
        }
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
    },
  };
}
