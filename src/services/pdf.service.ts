import PDFDocument from "pdfkit";
import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "../generated/prisma/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type InvoiceSnapshot = {
  invoiceNumber: string;
  saleId: string;
  date: string;
  company?: {
    name?: string | null | undefined;
    gst?: string | null | undefined;
    pan?: string | null | undefined;
    address?: string | null | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    terms?: string | null | undefined;
  };
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
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Invoice - ${snapshot.invoiceNumber || "FemmeFlo"}`,
          Author: "FemmeFlo",
          Subject: "Tax Invoice / Bill of Supply",
        },
      });

      const buffers: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err: Error) => reject(err));

      // Color Palette - Clean, Modern & Elegant
      const PRIMARY = "#831843"; // Deep Wine / Rose 900
      const PRIMARY_LIGHT = "#FDF2F8"; // Soft Tint
      const TEXT_DARK = "#1E293B"; // Slate 800
      const TEXT_MUTED = "#64748B"; // Slate 500
      const BORDER_COLOR = "#E2E8F0"; // Slate 200
      const TABLE_HEADER_BG = "#F8FAFC"; // Slate 50
      const SUCCESS_GREEN = "#15803D"; // Emerald 700

      const left = 40;
      const right = 555;
      const pageWidth = right - left; // 515

      // Resolve FemmeFlo and Masako Logos
      const resolveAsset = (filename: string) => {
        const candidates = [
          path.resolve(process.cwd(), "public", "assets", filename),
          path.resolve(__dirname, "../../public/assets", filename),
          path.resolve(__dirname, "../../../public/assets", filename),
          path.resolve(process.cwd(), "../femmeflo/public", filename),
        ];
        return candidates.find((p) => fsSync.existsSync(p)) || null;
      };

      const femmefloLogoPath = resolveAsset("femmeflo-logo.png") || resolveAsset("Femmeflo logo.png") || resolveAsset("logo.png");
      const masakoLogoPath = resolveAsset("masako-logo.jpeg") || resolveAsset("Masako logo.jpeg");

      // 1. Top Decorative Brand Bar
      doc.rect(left, 35, pageWidth, 4).fill(PRIMARY);

      // 2. Header Section
      const headerY = 50;

      // Brand Logo / Title & Company GST Details (Left column: width 250)
      const company = snapshot.company || {};
      const companyName = company.name || "FemmeFlo";

      let brandY = headerY;
      let drawnLogo = false;

      // Draw FemmeFlo Logo
      if (femmefloLogoPath) {
        try {
          doc.image(femmefloLogoPath, left, headerY, { height: 36 });
          drawnLogo = true;
        } catch (e) {
          // ignore error
        }
      }

      // Draw Masako Brand Logo beside or below
      if (masakoLogoPath) {
        try {
          const masakoX = femmefloLogoPath ? left + 130 : left;
          doc.image(masakoLogoPath, masakoX, headerY, { height: 34 });
          drawnLogo = true;
        } catch (e) {
          // ignore error
        }
      }

      if (drawnLogo) {
        brandY += 42;
      } else {
        doc.fontSize(20).font("Helvetica-Bold").fillColor(PRIMARY).text(companyName.toUpperCase(), left, headerY);
        brandY += 24;
      }

      // Company Name & GST details below logo
      doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT_DARK).text(companyName, left, brandY);
      brandY += 12;

      if (company.gst) {
        doc.fontSize(8).font("Helvetica-Bold").fillColor(PRIMARY).text(`GSTIN: ${company.gst}`, left, brandY);
        brandY += 11;
      }
      if (company.pan) {
        doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_MUTED).text(`PAN: ${company.pan}`, left, brandY);
        brandY += 10;
      }
      if (company.address) {
        doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_MUTED).text(company.address, left, brandY, { width: 230, lineGap: 1 });
        brandY += 16;
      }
      const compContact = [company.phone, company.email].filter(Boolean).join("  •  ");
      if (compContact) {
        doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_MUTED).text(compContact, left, brandY, { width: 230 });
      }

      // Right Column: TAX INVOICE Header & Metadata block (Right aligned)
      const metaBoxX = 290;
      const metaBoxWidth = right - metaBoxX; // 265

      doc.fontSize(22)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY)
        .text("TAX INVOICE", metaBoxX, headerY, { width: metaBoxWidth, align: "right" });

      const dateObj = snapshot.date ? new Date(snapshot.date) : new Date();
      const formattedDate = dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const formattedTime = dateObj.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      let metaY = headerY + 28;
      // Invoice # line
      doc.fontSize(8.5).font("Helvetica").fillColor(TEXT_MUTED).text("Invoice Number:", metaBoxX, metaY, { width: 100, align: "right" });
      doc.font("Helvetica-Bold").fillColor(PRIMARY).text(snapshot.invoiceNumber || "N/A", metaBoxX + 105, metaY, { width: metaBoxWidth - 105, align: "right" });

      metaY += 14;
      // Date line
      doc.fontSize(8.5).font("Helvetica").fillColor(TEXT_MUTED).text("Date & Time:", metaBoxX, metaY, { width: 100, align: "right" });
      doc.font("Helvetica-Bold").fillColor(TEXT_DARK).text(`${formattedDate}, ${formattedTime}`, metaBoxX + 105, metaY, { width: metaBoxWidth - 105, align: "right" });

      // Sale Reference line removed per user requirements

      // Divider below header
      doc.moveTo(left, 118).lineTo(right, 118).lineWidth(1).strokeColor(BORDER_COLOR).stroke();

      // 3. Information Cards (Billed To / Sold By)
      const cardY = 130;
      const cardGap = 15;
      const cardWidth = (pageWidth - cardGap) / 2; // 250
      const cardHeight = 104;

      // Customer Card (Left)
      doc.roundedRect(left, cardY, cardWidth, cardHeight, 6)
        .fillAndStroke(PRIMARY_LIGHT, BORDER_COLOR);

      doc.fontSize(9.5)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY)
        .text("BILLED TO / CUSTOMER", left + 14, cardY + 12);

      const cust = snapshot.customer || { shopName: "", contactName: "", phone: "" };
      doc.fontSize(11)
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text(cust.shopName || "Walk-in Customer", left + 14, cardY + 28, { width: cardWidth - 28 });

      doc.fontSize(8.5)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text(`Contact Person: `, left + 14, cardY + 44, { continued: true })
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text(cust.contactName || "N/A");

      doc.font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text(`Phone Number: `, left + 14, cardY + 58, { continued: true })
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text(cust.phone || "N/A");

      const territory = [cust.village, cust.district, cust.state].filter(Boolean).join(", ");
      if (territory) {
        doc.font("Helvetica")
          .fillColor(TEXT_MUTED)
          .text(`Territory: `, left + 14, cardY + 72, { continued: true })
          .font("Helvetica")
          .fillColor(TEXT_DARK)
          .text(territory, { width: cardWidth - 28, ellipsis: true });
      }

      // Seller / Enterprise Card (Right)
      const sellerX = left + cardWidth + cardGap;
      doc.roundedRect(sellerX, cardY, cardWidth, cardHeight, 6)
        .fillAndStroke("#F8FAFC", BORDER_COLOR);

      doc.fontSize(9.5)
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text("ISSUED BY / ENTERPRISE", sellerX + 14, cardY + 12);

      const seller = snapshot.seller || { name: "", phone: "" };
      const issuedByName = companyName || "MASAKO ENTERPRISES PRIVATE LIMITED";

      doc.fontSize(10)
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text(issuedByName, sellerX + 14, cardY + 27, { width: cardWidth - 28, lineGap: 1 });

      doc.fontSize(8.5)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text(`Field Officer: `, sellerX + 14, cardY + 43, { continued: true })
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text(seller.name || "Authorized Representative");

      doc.font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text(`Officer Contact: `, sellerX + 14, cardY + 57, { continued: true })
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text(seller.phone || "N/A");

      if (company.gst) {
        doc.font("Helvetica")
          .fillColor(TEXT_MUTED)
          .text(`GSTIN: `, sellerX + 14, cardY + 71, { continued: true })
          .font("Helvetica-Bold")
          .fillColor(PRIMARY)
          .text(company.gst, { width: cardWidth - 28, ellipsis: true });
      } else {
        doc.font("Helvetica")
          .fillColor(TEXT_MUTED)
          .text(`Channel: Direct Field Distribution Network`, sellerX + 14, cardY + 71);
      }

      // 4. Line Items Table
      const tableTop = 250;
      const tableHeaderHeight = 24;

      // Header background
      doc.roundedRect(left, tableTop, pageWidth, tableHeaderHeight, 4)
        .fillColor(TABLE_HEADER_BG)
        .fill();
      doc.roundedRect(left, tableTop, pageWidth, tableHeaderHeight, 4)
        .lineWidth(0.8)
        .strokeColor(BORDER_COLOR)
        .stroke();

      // Column widths & positions
      const colNo = left + 12;
      const colDesc = left + 40;
      const colQty = left + 280;
      const colRate = left + 345;
      const colTotal = left + 435;
      const colTotalWidth = right - colTotal - 12;

      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(TEXT_DARK);
      doc.text("#", colNo, tableTop + 7, { width: 25 });
      doc.text("ITEM DESCRIPTION", colDesc, tableTop + 7, { width: 230 });
      doc.text("QTY", colQty, tableTop + 7, { width: 50, align: "center" });
      doc.text("UNIT PRICE (INR)", colRate, tableTop + 7, { width: 80, align: "right" });
      doc.text("TOTAL (INR)", colTotal, tableTop + 7, { width: colTotalWidth, align: "right" });

      // Item Row
      const rowY = tableTop + tableHeaderHeight + 6;
      const rowHeight = 36;

      doc.rect(left, rowY, pageWidth, rowHeight)
        .fillColor("#FFFFFF")
        .fill();
      doc.moveTo(left, rowY + rowHeight)
        .lineTo(right, rowY + rowHeight)
        .lineWidth(0.5)
        .strokeColor(BORDER_COLOR)
        .stroke();

      const unitPrice = ((snapshot.unitPricePaise || 0) / 100).toFixed(2);
      const totalAmount = ((snapshot.totalPaise || 0) / 100).toFixed(2);

      doc.fontSize(9).font("Helvetica").fillColor(TEXT_DARK);
      doc.text("1", colNo, rowY + 8, { width: 25 });

      doc.font("Helvetica-Bold")
        .text("FemmeFlo Sanitary Napkins (Pack)", colDesc, rowY + 8);
      doc.fontSize(8)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("Standard Hygiene Pack", colDesc, rowY + 21);

      doc.fontSize(9)
        .font("Helvetica")
        .fillColor(TEXT_DARK)
        .text(String(snapshot.quantity || 0), colQty, rowY + 12, { width: 50, align: "center" });

      doc.text(`Rs. ${unitPrice}`, colRate, rowY + 12, { width: 80, align: "right" });

      doc.font("Helvetica-Bold")
        .text(`Rs. ${totalAmount}`, colTotal, rowY + 12, { width: colTotalWidth, align: "right" });

      // 5. Payment Details & Totals Section
      const summaryTop = rowY + rowHeight + 20;

      // Left Box: Payment Details Badge & Terms
      const paymentBoxWidth = 240;
      doc.roundedRect(left, summaryTop, paymentBoxWidth, 95, 6)
        .fillAndStroke("#F8FAFC", BORDER_COLOR);

      doc.fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text("PAYMENT SUMMARY", left + 14, summaryTop + 12);

      const payMode = (snapshot.paymentMode || "CASH").toUpperCase();
      doc.fontSize(8.5)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("Payment Mode: ", left + 14, summaryTop + 30, { continued: true })
        .font("Helvetica-Bold")
        .fillColor(payMode === "CASH" ? SUCCESS_GREEN : PRIMARY)
        .text(payMode);

      doc.font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("Payment Status: ", left + 14, summaryTop + 45, { continued: true })
        .font("Helvetica-Bold")
        .fillColor(SUCCESS_GREEN)
        .text("PAID & CONFIRMED");

      doc.fontSize(7.5)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("This computer-generated tax invoice serves as an official receipt of sale and proof of purchase.", left + 14, summaryTop + 62, {
          width: paymentBoxWidth - 28,
          lineGap: 2,
        });

      // Right Box: Financial Breakdown
      const totalsLeft = 320;
      const totalsWidth = right - totalsLeft;

      let lineY = summaryTop + 6;
      doc.fontSize(9)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("Subtotal", totalsLeft, lineY)
        .fillColor(TEXT_DARK)
        .text(`Rs. ${totalAmount}`, totalsLeft, lineY, { align: "right", width: totalsWidth });

      lineY += 18;
      doc.fontSize(9)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("Taxes & Surcharges (Incl.)", totalsLeft, lineY)
        .fillColor(TEXT_DARK)
        .text("Rs. 0.00", totalsLeft, lineY, { align: "right", width: totalsWidth });

      lineY += 18;
      doc.moveTo(totalsLeft, lineY).lineTo(right, lineY).lineWidth(0.8).strokeColor(BORDER_COLOR).stroke();

      lineY += 10;
      // Grand Total Highlight Box
      doc.roundedRect(totalsLeft - 8, lineY - 6, totalsWidth + 8, 38, 4)
        .fillColor(PRIMARY_LIGHT)
        .fill();

      doc.fontSize(10)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY)
        .text("TOTAL DUE / PAID", totalsLeft, lineY + 7)
        .fontSize(13)
        .text(`Rs. ${totalAmount}`, totalsLeft, lineY + 5, { align: "right", width: totalsWidth });

      // 6. Support & Appreciation Note
      const signY = 485;
      doc.moveTo(left, signY).lineTo(right, signY).lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();

      doc.fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY)
        .text("Thank you for partnering with FemmeFlo!", left, signY + 16, { align: "center" });

      doc.fontSize(8)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("For questions, orders, or support, please contact your field seller or FemmeFlo administration.", left, signY + 30, { align: "center" });

      // 7. Footer
      const footerY = 780;
      doc.moveTo(left, footerY).lineTo(right, footerY).lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();
      doc.fontSize(7.5)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("FemmeFlo Inventory Management System  •  Official Digital Tax Invoice", left, footerY + 8, { align: "center" });

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

  let snapshot = invoice.snapshot as unknown as InvoiceSnapshot;
  // Real-time update: always query latest BusinessSettings so edits to enterprise name, GST, etc. reflect immediately on PDF render
  const settings = await database.businessSettings.findUnique({ where: { id: 1 } });
  if (settings) {
    snapshot = {
      ...snapshot,
      company: {
        name: settings.companyName || snapshot.company?.name || "MASAKO ENTERPRISES PRIVATE LIMITED",
        gst: settings.companyGst || snapshot.company?.gst,
        pan: settings.companyPan || snapshot.company?.pan,
        address: settings.companyAddress || snapshot.company?.address,
        phone: settings.companyPhone || snapshot.company?.phone,
        email: settings.companyEmail || snapshot.company?.email,
        terms: settings.invoiceTerms || snapshot.company?.terms,
      },
    };
  }
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
