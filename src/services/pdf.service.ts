import PDFDocument from "pdfkit";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client.js";

export type InvoiceSnapshot = {
  invoiceNumber: string;
  saleId: string;
  date: string;
  customer: {
    shopName: string;
    contactName: string;
    phone: string;
    state?: string;
    district?: string;
    village?: string;
  };
  seller: {
    name: string;
    phone: string;
  };
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  paymentMode: string;
};

export function generateInvoicePdfBuffer(snapshot: InvoiceSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err: Error) => reject(err));

      const fontName = "Helvetica";
      const boldFont = "Helvetica-Bold";

      // Title
      doc.fontSize(20).font(boldFont).text("INVOICE", { align: "center" });
      doc.moveDown();

      // Invoice Meta
      const dateStr = snapshot.date ? new Date(snapshot.date).toLocaleString() : new Date().toLocaleString();
      doc.fontSize(12).font(fontName).text(`Invoice Number: ${snapshot.invoiceNumber || ""}`);
      doc.text(`Date: ${dateStr}`);
      doc.text(`Sale ID: ${snapshot.saleId || ""}`);
      doc.moveDown();

      // Customer Details
      doc.fontSize(14).font(boldFont).text("Customer / Shop Information:", { underline: true });
      doc.fontSize(10).font(fontName).text(`Shop Name: ${snapshot.customer?.shopName || ""}`);
      doc.text(`Contact Name: ${snapshot.customer?.contactName || ""}`);
      doc.text(`Phone: ${snapshot.customer?.phone || ""}`);
      if (snapshot.customer?.state || snapshot.customer?.district || snapshot.customer?.village) {
        doc.text(`Territory: ${[snapshot.customer.village, snapshot.customer.district, snapshot.customer.state].filter(Boolean).join(", ")}`);
      }
      doc.moveDown();

      // Seller Details
      doc.fontSize(14).font(boldFont).text("Seller Information:", { underline: true });
      doc.fontSize(10).font(fontName).text(`Seller Name: ${snapshot.seller?.name || ""}`);
      doc.text(`Seller Phone: ${snapshot.seller?.phone || ""}`);
      doc.moveDown();

      // Item Table Summary
      doc.fontSize(14).font(boldFont).text("Order Summary:", { underline: true });
      doc.fontSize(10).font(fontName).text(`Packets Sold: ${snapshot.quantity || 0}`);
      // Explicitly set font before rendering unit price and total amount
      doc.font(fontName);
      doc.text(`Unit Price: Rs. ${((snapshot.unitPricePaise || 0) / 100).toFixed(2)}`);
      doc.text(`Total Amount: Rs. ${((snapshot.totalPaise || 0) / 100).toFixed(2)}`);
      doc.text(`Payment Mode: ${snapshot.paymentMode || ""}`);
      doc.moveDown(2);

      doc.fontSize(10).font(fontName).text("Thank you for your business!", { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function processInvoicePdf(database: PrismaClient, invoiceId: string): Promise<string> {
  const invoice = await database.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new Error(`Invoice with ID ${invoiceId} not found`);
  }

  // Idempotency check: if PDF already generated and stored, skip regenerate
  if (invoice.pdfPath) {
    return invoice.pdfPath;
  }

  const snapshot = invoice.snapshot as unknown as InvoiceSnapshot;
  const pdfBuffer = await generateInvoicePdfBuffer(snapshot);

  const dateObj = new Date(invoice.createdAt);
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const relativePath = `invoices/${year}/${month}/${invoice.number}.pdf`;
  const storageDir = path.resolve(process.cwd(), "public", "storage");
  const fullDiskPath = path.join(storageDir, relativePath);

  // Write pdfBuffer to filePath and confirm write succeeds before DB update
  await fs.mkdir(path.dirname(fullDiskPath), { recursive: true });
  await fs.writeFile(fullDiskPath, pdfBuffer);

  const stat = await fs.stat(fullDiskPath);
  if (!stat || stat.size === 0) {
    throw new Error(`Failed to write PDF file to ${fullDiskPath}`);
  }

  const pdfPath = `/storage/${relativePath}`;

  // Update Prisma invoice pdfPath only after successful write
  const updated = await database.invoice.update({
    where: { id: invoiceId },
    data: { pdfPath },
  });

  return updated.pdfPath!;
}
