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
    address?: string | null | undefined;
    pincode?: string | null | undefined;
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
  lineItems?: Array<{
    productName: string;
    productSku?: string | null;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
  }>;
  paymentMode: string;
};

const DEFAULT_COMPANY_NAME = "MASAKO ENTERPRISES PRIVATE LIMITED";

export function formatStructuredCustomerAddressLines(customer?: InvoiceSnapshot["customer"] | null): string[] {
  if (!customer) return [];
  const rawAddress = (customer.address || "").trim();
  const village = (customer.village || "").trim();
  const district = (customer.district || "").trim();
  const state = (customer.state || "").trim();
  const pincode = (customer.pincode || "").trim();

  // Collect region parts while avoiding exact duplicate segments across address / village / district / state
  const existingSegments = new Set(
    rawAddress
      .split(",")
      .map((seg) => seg.trim().toLowerCase())
      .filter(Boolean)
  );
  const regionParts: string[] = [];
  const pushUniquePart = (part: string) => {
    const clean = part.trim();
    if (!clean) return;
    // Also split comma-separated composite fields cleanly
    for (const sub of clean.split(",")) {
      const s = sub.trim();
      if (!s) continue;
      const lower = s.toLowerCase();
      if (existingSegments.has(lower)) continue;
      existingSegments.add(lower);
      regionParts.push(s);
    }
  };

  if (village) pushUniquePart(village);
  if (district) pushUniquePart(district);
  if (state) pushUniquePart(state);

  let regionLine = regionParts.join(", ");
  if (pincode && !existingSegments.has(pincode.toLowerCase()) && !regionLine.includes(pincode)) {
    regionLine = regionLine ? `${regionLine} - ${pincode}` : `PIN ${pincode}`;
  }

  const lines: string[] = [];
  if (rawAddress) {
    lines.push(rawAddress);
  }
  if (regionLine) {
    lines.push(regionLine);
  }
  return lines;
}

export function enrichInvoiceSnapshotFromRecord(
  invoice: {
    number: string;
    saleId: string;
    createdAt: Date | string;
    snapshot?: unknown;
    sale?: {
      quantity?: number;
      unitPricePaise?: number;
      totalPaise?: number;
      paymentMode?: string;
      confirmedAt?: Date | string | null;
      createdAt?: Date | string;
      customer?: {
        shopName?: string | null;
        contactName?: string | null;
        phone?: string | null;
        address?: string | null;
        pincode?: string | null;
        state?: string | null;
        district?: string | null;
        village?: string | null;
      } | null;
      seller?: {
        name?: string | null;
        phone?: string | null;
      } | null;
      lineItems?: Array<{
        quantity: number;
        unitPricePaise: number;
        totalPaise: number;
        product?: { name?: string | null; sku?: string | null } | null;
      }>;
    } | null;
  },
  settings?: {
    companyName?: string | null;
    companyGst?: string | null;
    companyPan?: string | null;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    invoiceTerms?: string | null;
  } | null
): InvoiceSnapshot {
  const existing = (invoice.snapshot || {}) as Partial<InvoiceSnapshot>;
  const sale = invoice.sale;
  const cust = sale?.customer;
  const existingCust = (existing.customer || {}) as Partial<InvoiceSnapshot["customer"]>;

  const totalQty =
    sale?.lineItems && sale.lineItems.length > 0
      ? sale.lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0)
      : existing.quantity ?? sale?.quantity ?? 0;

  const totalPaise = existing.totalPaise ?? sale?.totalPaise ?? 0;
  const unitPricePaise =
    existing.unitPricePaise ??
    sale?.unitPricePaise ??
    (totalQty > 0 ? Math.round(totalPaise / totalQty) : 0);

  const lineItems =
    existing.lineItems && existing.lineItems.length > 0
      ? existing.lineItems
      : sale?.lineItems?.map((li) => ({
          productName: li.product?.name || "FemmeFlo",
          productSku: li.product?.sku ?? null,
          quantity: li.quantity,
          unitPricePaise: li.unitPricePaise,
          totalPaise: li.totalPaise,
        }));

  const dateVal =
    existing.date ||
    (sale?.confirmedAt
      ? new Date(sale.confirmedAt).toISOString()
      : sale?.createdAt
        ? new Date(sale.createdAt).toISOString()
        : new Date(invoice.createdAt).toISOString());

  let snapshot: InvoiceSnapshot = {
    invoiceNumber: existing.invoiceNumber || invoice.number,
    saleId: existing.saleId || invoice.saleId,
    date: dateVal,
    customer: {
      shopName: cust?.shopName || existingCust.shopName || "Customer Store",
      contactName: cust?.contactName || existingCust.contactName || "Customer",
      phone: cust?.phone || existingCust.phone || "",
      ...(cust?.address || existingCust.address
        ? { address: cust?.address || existingCust.address }
        : {}),
      ...(cust?.pincode || existingCust.pincode
        ? { pincode: cust?.pincode || existingCust.pincode }
        : {}),
      ...(cust?.village || existingCust.village
        ? { village: cust?.village || existingCust.village }
        : {}),
      ...(cust?.district || existingCust.district
        ? { district: cust?.district || existingCust.district }
        : {}),
      ...(cust?.state || existingCust.state
        ? { state: cust?.state || existingCust.state }
        : {}),
    },
    seller: {
      name: sale?.seller?.name || existing.seller?.name || "Seller",
      phone: sale?.seller?.phone || existing.seller?.phone || "",
    },
    quantity: totalQty,
    unitPricePaise,
    totalPaise,
    ...(lineItems && lineItems.length > 0 ? { lineItems } : {}),
    paymentMode: existing.paymentMode || sale?.paymentMode || "CASH",
    ...(existing.company ? { company: existing.company } : {}),
  };

  if (settings) {
    snapshot = {
      ...snapshot,
      company: {
        name: settings.companyName || snapshot.company?.name || DEFAULT_COMPANY_NAME,
        gst: settings.companyGst || snapshot.company?.gst,
        pan: settings.companyPan || snapshot.company?.pan,
        address: settings.companyAddress || snapshot.company?.address,
        phone: settings.companyPhone || snapshot.company?.phone,
        email: settings.companyEmail || snapshot.company?.email,
        terms: settings.invoiceTerms || snapshot.company?.terms,
      },
    };
  }

  return snapshot;
}

type StyledBlock = {
  text: string;
  font?: string;
  size: number;
  color: string;
  lineGap?: number;
  spaceAfter?: number;
  label?: string;
};

function measureStyledBlocksHeight(
  doc: InstanceType<typeof PDFDocument>,
  blocks: StyledBlock[],
  width: number
): number {
  let height = 0;
  for (const b of blocks) {
    const combined = b.label ? `${b.label}${b.text}` : b.text;
    doc.fontSize(b.size).font(b.font || "Helvetica");
    const h = doc.heightOfString(combined, {
      width,
      lineGap: b.lineGap ?? 1.5,
    });
    height += h + (b.spaceAfter ?? 3);
  }
  return height;
}

function drawStyledBlocks(
  doc: InstanceType<typeof PDFDocument>,
  blocks: StyledBlock[],
  x: number,
  startY: number,
  width: number,
  mutedColor: string
): number {
  let y = startY;
  for (const b of blocks) {
    const lineGap = b.lineGap ?? 1.5;
    if (b.label) {
      const combined = `${b.label}${b.text}`;
      doc.fontSize(b.size).font(b.font || "Helvetica-Bold");
      const blockH = doc.heightOfString(combined, { width, lineGap });
      doc
        .fontSize(b.size)
        .font("Helvetica")
        .fillColor(mutedColor)
        .text(b.label, x, y, { width, lineGap, continued: true })
        .font(b.font || "Helvetica-Bold")
        .fillColor(b.color)
        .text(b.text, { width, lineGap });
      y += blockH + (b.spaceAfter ?? 3);
    } else {
      doc.fontSize(b.size).font(b.font || "Helvetica").fillColor(b.color);
      const blockH = doc.heightOfString(b.text, { width, lineGap });
      doc.text(b.text, x, y, { width, lineGap });
      y += blockH + (b.spaceAfter ?? 3);
    }
  }
  return y;
}

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
      doc.rect(left, 32, pageWidth, 4).fill(PRIMARY);

      // 2. Header Section (Logo Only - no duplicate written FemmeFlo text when logo renders)
      const headerY = 48;

      const company = snapshot.company || {};
      const companyName = company.name || DEFAULT_COMPANY_NAME;

      let leftHeaderBottomY = headerY + 34;
      let drawnLogo = false;

      if (masakoLogoPath) {
        try {
          doc.image(masakoLogoPath, left, headerY, { height: 36 });
          drawnLogo = true;
        } catch {
          // ignore logo read errors and rely on remaining logo or text fallback
        }
      }

      if (femmefloLogoPath) {
        try {
          const femmefloX = masakoLogoPath ? left + 44 : left;
          doc.image(femmefloLogoPath, femmefloX, headerY + 3, { height: 30 });
          drawnLogo = true;
        } catch {
          // ignore logo read errors
        }
      }

      if (drawnLogo) {
        leftHeaderBottomY = headerY + 38;
      } else {
        const fallbackTitle = companyName.toUpperCase();
        doc.fontSize(15).font("Helvetica-Bold").fillColor(PRIMARY);
        const titleH = doc.heightOfString(fallbackTitle, { width: 235 });
        doc.text(fallbackTitle, left, headerY, { width: 235 });
        leftHeaderBottomY = headerY + Math.max(22, titleH);
      }

      // Right Column: TAX INVOICE Header & Metadata block (Right aligned)
      const metaBoxX = 290;
      const metaBoxWidth = right - metaBoxX; // 265

      doc.fontSize(21)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY)
        .text("TAX INVOICE", metaBoxX, headerY, { width: metaBoxWidth, align: "right" });

      const dateObj = snapshot.date ? new Date(snapshot.date) : new Date();
      const formattedDate = dateObj.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const formattedTime = dateObj.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      let metaY = headerY + 26;
      doc.fontSize(8.5).font("Helvetica").fillColor(TEXT_MUTED).text("Invoice Number:", metaBoxX, metaY, { width: 95, align: "right" });
      doc.font("Helvetica-Bold").fillColor(PRIMARY).text(snapshot.invoiceNumber || "N/A", metaBoxX + 100, metaY, { width: metaBoxWidth - 100, align: "right" });

      metaY += 13;
      doc.fontSize(8.5).font("Helvetica").fillColor(TEXT_MUTED).text("Date & Time:", metaBoxX, metaY, { width: 95, align: "right" });
      doc.font("Helvetica-Bold").fillColor(TEXT_DARK).text(`${formattedDate}, ${formattedTime}`, metaBoxX + 100, metaY, { width: metaBoxWidth - 100, align: "right" });

      const metaBottomY = metaY + 13;
      const headerDividerY = Math.max(leftHeaderBottomY, metaBottomY) + 10;

      // Divider below header
      doc.moveTo(left, headerDividerY).lineTo(right, headerDividerY).lineWidth(1).strokeColor(BORDER_COLOR).stroke();

      // 3. Responsive, Well-Structured Information Cards (Billed To / Issued By)
      const cardY = headerDividerY + 12;
      const cardGap = 15;
      const cardWidth = (pageWidth - cardGap) / 2; // 250
      const cardPadX = 14;
      const cardPadTop = 12;
      const cardPadBottom = 10;
      const cardInnerW = cardWidth - cardPadX * 2; // 222

      const cust = snapshot.customer || { shopName: "", contactName: "", phone: "" };
      const addressLines = formatStructuredCustomerAddressLines(cust);

      const leftBlocks: StyledBlock[] = [
        {
          text: "BILLED TO / CUSTOMER",
          font: "Helvetica-Bold",
          size: 8.5,
          color: PRIMARY,
          spaceAfter: 5,
        },
        {
          text: cust.shopName || "Walk-in Customer",
          font: "Helvetica-Bold",
          size: 10.5,
          color: TEXT_DARK,
          spaceAfter: 4,
        },
        {
          label: "Contact Person: ",
          text: cust.contactName || "N/A",
          font: "Helvetica-Bold",
          size: 8.2,
          color: TEXT_DARK,
          spaceAfter: 2.5,
        },
        {
          label: "Phone: ",
          text: cust.phone || "N/A",
          font: "Helvetica-Bold",
          size: 8.2,
          color: TEXT_DARK,
          spaceAfter: addressLines.length > 0 ? 3.5 : 0,
        },
      ];

      if (addressLines.length > 0) {
        leftBlocks.push({
          label: "Address: ",
          text: addressLines[0]!,
          font: "Helvetica",
          size: 8,
          color: TEXT_DARK,
          lineGap: 1.8,
          spaceAfter: addressLines.length > 1 ? 1.5 : 0,
        });
        for (let i = 1; i < addressLines.length; i++) {
          leftBlocks.push({
            text: addressLines[i]!,
            font: "Helvetica",
            size: 8,
            color: TEXT_MUTED,
            lineGap: 1.8,
            spaceAfter: i === addressLines.length - 1 ? 0 : 1.5,
          });
        }
      }

      const seller = snapshot.seller || { name: "", phone: "" };
      const issuedByName = company.name || companyName || DEFAULT_COMPANY_NAME;

      const rightBlocks: StyledBlock[] = [
        {
          text: "ISSUED BY / ENTERPRISE",
          font: "Helvetica-Bold",
          size: 8.5,
          color: TEXT_DARK,
          spaceAfter: 5,
        },
        {
          text: issuedByName,
          font: "Helvetica-Bold",
          size: 9.5,
          color: TEXT_DARK,
          spaceAfter: 3,
        },
      ];

      if (company.address && company.address.trim()) {
        rightBlocks.push({
          text: company.address.trim(),
          font: "Helvetica",
          size: 7.8,
          color: TEXT_MUTED,
          lineGap: 1.8,
          spaceAfter: 3.5,
        });
      }

      const taxParts: string[] = [];
      if (company.gst) taxParts.push(`GSTIN: ${company.gst}`);
      if (company.pan) taxParts.push(`PAN: ${company.pan}`);
      if (taxParts.length > 0) {
        rightBlocks.push({
          text: taxParts.join("  •  "),
          font: "Helvetica-Bold",
          size: 7.5,
          color: PRIMARY,
          lineGap: 1.5,
          spaceAfter: 3,
        });
      }

      const contactParts: string[] = [];
      if (company.phone) contactParts.push(`Ph: ${company.phone}`);
      if (company.email) contactParts.push(company.email);
      if (contactParts.length > 0) {
        rightBlocks.push({
          text: contactParts.join("  •  "),
          font: "Helvetica",
          size: 7.5,
          color: TEXT_MUTED,
          lineGap: 1.5,
          spaceAfter: 3,
        });
      }

      const officerLine = seller.phone
        ? `${seller.name || "Authorized Representative"}  |  ${seller.phone}`
        : seller.name || "Authorized Representative";
      rightBlocks.push({
        label: "Field Officer: ",
        text: officerLine,
        font: "Helvetica-Bold",
        size: 8,
        color: TEXT_DARK,
        lineGap: 1.5,
        spaceAfter: 0,
      });

      const leftContentHeight = measureStyledBlocksHeight(doc, leftBlocks, cardInnerW);
      const rightContentHeight = measureStyledBlocksHeight(doc, rightBlocks, cardInnerW);
      const cardHeight = Math.max(106, cardPadTop + Math.max(leftContentHeight, rightContentHeight) + cardPadBottom);

      // Draw Equal-Height Cards First
      doc.roundedRect(left, cardY, cardWidth, cardHeight, 6)
        .fillAndStroke(PRIMARY_LIGHT, BORDER_COLOR);

      const sellerX = left + cardWidth + cardGap;
      doc.roundedRect(sellerX, cardY, cardWidth, cardHeight, 6)
        .fillAndStroke("#F8FAFC", BORDER_COLOR);

      // Draw Wrapped Text Content Strictly Inside Card Bounds
      drawStyledBlocks(doc, leftBlocks, left + cardPadX, cardY + cardPadTop, cardInnerW, TEXT_MUTED);
      drawStyledBlocks(doc, rightBlocks, sellerX + cardPadX, cardY + cardPadTop, cardInnerW, TEXT_MUTED);

      // 4. Line Items Table (Dynamic Y below Cards)
      const tableTop = cardY + cardHeight + 16;
      const tableHeaderHeight = 24;

      // Column widths & positions
      const colNo = left + 12;
      const colDesc = left + 38;
      const colDescWidth = 228;
      const colQty = left + 274;
      const colRate = left + 334;
      const colTotal = left + 424;
      const colTotalWidth = right - colTotal - 12;

      const drawTableHeader = (yPos: number) => {
        doc.roundedRect(left, yPos, pageWidth, tableHeaderHeight, 4)
          .fillColor(TABLE_HEADER_BG)
          .fill();
        doc.roundedRect(left, yPos, pageWidth, tableHeaderHeight, 4)
          .lineWidth(0.8)
          .strokeColor(BORDER_COLOR)
          .stroke();

        doc.fontSize(8.5).font("Helvetica-Bold").fillColor(TEXT_DARK);
        doc.text("#", colNo, yPos + 7, { width: 22 });
        doc.text("ITEM DESCRIPTION", colDesc, yPos + 7, { width: colDescWidth });
        doc.text("QTY", colQty, yPos + 7, { width: 52, align: "center" });
        doc.text("UNIT PRICE (INR)", colRate, yPos + 7, { width: 82, align: "right" });
        doc.text("TOTAL (INR)", colTotal, yPos + 7, { width: colTotalWidth, align: "right" });
      };

      drawTableHeader(tableTop);

      // Item Rows
      const rows = snapshot.lineItems && snapshot.lineItems.length > 0
        ? snapshot.lineItems.map((li, i) => ({
            num: i + 1,
            name: li.productName,
            desc: li.productSku || "",
            qty: li.quantity,
            unitPrice: ((li.unitPricePaise || 0) / 100).toFixed(2),
            total: ((li.totalPaise || 0) / 100).toFixed(2),
          }))
        : [{
            num: 1,
            name: "FemmeFlo Sanitary Napkins (Pack)",
            desc: "Standard Hygiene Pack",
            qty: snapshot.quantity || 0,
            unitPrice: ((snapshot.unitPricePaise || 0) / 100).toFixed(2),
            total: ((snapshot.totalPaise || 0) / 100).toFixed(2),
          }];

      const totalAmount = ((snapshot.totalPaise || 0) / 100).toFixed(2);
      let currentRowY = tableTop + tableHeaderHeight + 4;

      for (const row of rows) {
        doc.fontSize(9).font("Helvetica-Bold");
        const nameH = doc.heightOfString(row.name, { width: colDescWidth });
        let descH = 0;
        if (row.desc) {
          doc.fontSize(7.8).font("Helvetica");
          descH = doc.heightOfString(row.desc, { width: colDescWidth }) + 2;
        }
        const rowHeight = Math.max(36, 16 + nameH + descH);

        if (currentRowY + rowHeight > 740) {
          doc.addPage();
          currentRowY = 44;
          drawTableHeader(currentRowY);
          currentRowY += tableHeaderHeight + 4;
        }

        doc.rect(left, currentRowY, pageWidth, rowHeight)
          .fillColor("#FFFFFF")
          .fill();
        doc.moveTo(left, currentRowY + rowHeight)
          .lineTo(right, currentRowY + rowHeight)
          .lineWidth(0.5)
          .strokeColor(BORDER_COLOR)
          .stroke();

        const midOffset = Math.max(8, Math.round((rowHeight - 12) / 2));

        doc.fontSize(9).font("Helvetica").fillColor(TEXT_DARK);
        doc.text(String(row.num), colNo, currentRowY + midOffset, { width: 22 });

        doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT_DARK);
        doc.text(row.name, colDesc, currentRowY + 8, { width: colDescWidth });
        if (row.desc) {
          doc.fontSize(7.8)
            .font("Helvetica")
            .fillColor(TEXT_MUTED)
            .text(row.desc, colDesc, currentRowY + 8 + nameH + 2, { width: colDescWidth });
        }

        doc.fontSize(9)
          .font("Helvetica")
          .fillColor(TEXT_DARK)
          .text(String(row.qty), colQty, currentRowY + midOffset, { width: 52, align: "center" });

        doc.text(`Rs. ${row.unitPrice}`, colRate, currentRowY + midOffset, { width: 82, align: "right" });

        doc.font("Helvetica-Bold")
          .text(`Rs. ${row.total}`, colTotal, currentRowY + midOffset, { width: colTotalWidth, align: "right" });

        currentRowY += rowHeight;
      }

      // 5. Payment Details & Totals Section
      let summaryTop = currentRowY + 18;
      if (summaryTop + 160 > 780) {
        doc.addPage();
        summaryTop = 48;
      }

      // Left Box: Payment Details Badge & Terms
      const paymentBoxWidth = 245;
      const declarationText =
        company.terms ||
        "This computer-generated tax invoice serves as an official receipt of sale and proof of purchase.";
      doc.fontSize(7.3).font("Helvetica");
      const declHeight = doc.heightOfString(declarationText, {
        width: paymentBoxWidth - 28,
        lineGap: 1.5,
      });
      const paymentBoxHeight = Math.max(95, 68 + declHeight);

      doc.roundedRect(left, summaryTop, paymentBoxWidth, paymentBoxHeight, 6)
        .fillAndStroke("#F8FAFC", BORDER_COLOR);

      doc.fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(TEXT_DARK)
        .text("PAYMENT SUMMARY", left + 14, summaryTop + 12, { width: paymentBoxWidth - 28 });

      const payMode = (snapshot.paymentMode || "CASH").toUpperCase();
      doc.fontSize(8.5)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("Payment Mode: ", left + 14, summaryTop + 30, { width: paymentBoxWidth - 28, continued: true })
        .font("Helvetica-Bold")
        .fillColor(payMode === "CASH" ? SUCCESS_GREEN : PRIMARY)
        .text(payMode, { width: paymentBoxWidth - 28 });

      const isPendingPayment = payMode === "PENDING";
      doc.font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("Payment Status: ", left + 14, summaryTop + 45, { width: paymentBoxWidth - 28, continued: true })
        .font("Helvetica-Bold")
        .fillColor(isPendingPayment ? "#B45309" : SUCCESS_GREEN)
        .text(isPendingPayment ? "PAYMENT PENDING" : "PAID & CONFIRMED", { width: paymentBoxWidth - 28 });

      doc.fontSize(7.3)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text(declarationText, left + 14, summaryTop + 60, {
          width: paymentBoxWidth - 28,
          lineGap: 1.5,
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
      doc.roundedRect(totalsLeft - 10, lineY - 6, totalsWidth + 10, 38, 4)
        .fillColor(PRIMARY_LIGHT)
        .fill();

      doc.fontSize(10)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY)
        .text("TOTAL DUE / PAID", totalsLeft, lineY + 7)
        .fontSize(13)
        .text(`Rs. ${totalAmount}`, totalsLeft, lineY + 5, { align: "right", width: totalsWidth - 10 });

      const totalsBottomY = lineY + 34;

      // 6. Support & Appreciation Note (Dynamically Positioned Below Summary)
      const signY = Math.max(summaryTop + paymentBoxHeight, totalsBottomY) + 24;
      doc.moveTo(left, signY).lineTo(right, signY).lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();

      const termsNote = company.terms ? company.terms : "Thank you for partnering with FemmeFlo!";
      doc.fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY)
        .text(termsNote, left, signY + 14, { align: "center", width: pageWidth });

      const signTermsH = doc.heightOfString(termsNote, { width: pageWidth });
      doc.fontSize(7.5)
        .font("Helvetica")
        .fillColor(TEXT_MUTED)
        .text("For questions, orders, or support, please contact your field officer or administration.", left, signY + 14 + signTermsH + 5, { align: "center", width: pageWidth });

      // 7. Footer removed per user requirement
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function processInvoicePdf(database: PrismaClient, invoiceId: string): Promise<string> {
  const invoice = await database.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      sale: {
        include: {
          customer: true,
          seller: { select: { id: true, name: true, phone: true } },
          lineItems: { include: { product: { select: { name: true, sku: true } } } },
        },
      },
    },
  });

  if (!invoice) {
    throw new Error(`Invoice with ID ${invoiceId} not found`);
  }

  // Always overlay live customer address and BusinessSettings configured in admin
  const settings = await database.businessSettings.findUnique({ where: { id: 1 } });
  const snapshot = enrichInvoiceSnapshotFromRecord(invoice, settings);
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
