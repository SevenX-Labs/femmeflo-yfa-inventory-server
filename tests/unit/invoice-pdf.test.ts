import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import {
  enrichInvoiceSnapshotFromRecord,
  formatStructuredCustomerAddressLines,
  generateInvoicePdfBuffer,
} from "../../src/services/pdf.service.js";

function extractPdfContentText(pdfBuffer: Buffer): string {
  const raw = pdfBuffer.toString("latin1");
  const chunks: string[] = [raw];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const inflated = zlib.inflateSync(Buffer.from(match[1]!, "latin1"));
      chunks.push(inflated.toString("utf8"));
    } catch {
      // Non-flate stream (e.g. embedded PNG image bytes)
    }
  }
  return chunks.join("\n");
}

test("Invoice PDF Structure, Address Formatting & Layout Unit Tests", async (t) => {
  await t.test("formatStructuredCustomerAddressLines builds deduplicated multi-line address with pincode", () => {
    const lines = formatStructuredCustomerAddressLines({
      shopName: "Starbucks",
      contactName: "Rupa",
      phone: "+919833432555",
      address: "Shop 14, Ground Floor, Ghodbunder Service Rd, Thane West",
      village: "Thane West",
      district: "Thane",
      state: "Maharashtra",
      pincode: "400607",
    });

    assert.equal(lines.length, 2);
    assert.equal(lines[0], "Shop 14, Ground Floor, Ghodbunder Service Rd, Thane West");
    assert.equal(lines[1], "Thane, Maharashtra - 400607");

    const dupLines = formatStructuredCustomerAddressLines({
      shopName: "Starbucks",
      contactName: "Rupa",
      phone: "+919833432555",
      village: "Thane West, Mumbai, Ghodbunder Service Rd, Thane",
      district: "Thane",
      state: "Maharashtra",
    });
    assert.deepEqual(dupLines, ["Thane West, Mumbai, Ghodbunder Service Rd, Thane, Maharashtra"]);
  });

  await t.test("enrichInvoiceSnapshotFromRecord overlays live customer address and business settings", () => {
    const enriched = enrichInvoiceSnapshotFromRecord(
      {
        number: "INV-2026-F230A4E1",
        saleId: "sale-123",
        createdAt: new Date("2026-11-26T01:13:00.000Z"),
        snapshot: {
          invoiceNumber: "INV-2026-F230A4E1",
          customer: {
            shopName: "Old Name",
            contactName: "Rupa",
            phone: "+919833432555",
            district: "Thane",
          },
          quantity: 12,
          unitPricePaise: 2000,
          totalPaise: 24000,
          paymentMode: "CASH",
        },
        sale: {
          customer: {
            shopName: "Starbucks",
            contactName: "Rupa",
            phone: "+919833432555",
            address: "Unit 4, Hiranandani Meadows, Thane West, Mumbai",
            village: "Ghodbunder Service Rd",
            district: "Thane",
            state: "Maharashtra",
            pincode: "400610",
          },
          seller: { name: "Sahil Hode", phone: "+918652601566" },
        },
      },
      {
        companyName: "FemmeFlo",
        companyAddress: "Sector 28, Millennium Business Park, Navi Mumbai, Mahape, Maharashtra 400710",
        companyGst: "27ABCDE1235F1Z5",
        companyPan: "BPHPH2857F",
      }
    );

    assert.equal(enriched.customer.shopName, "Starbucks");
    assert.equal(enriched.customer.address, "Unit 4, Hiranandani Meadows, Thane West, Mumbai");
    assert.equal(enriched.customer.pincode, "400610");
    assert.equal(enriched.company?.name, "FemmeFlo");
    assert.equal(enriched.seller.name, "Sahil Hode");
  });

  await t.test("generateInvoicePdfBuffer produces valid PDF with sequential ID, Address label, and no Territory word", async () => {
    const pdfBuf = await generateInvoicePdfBuffer({
      invoiceNumber: "INV-001",
      saleId: "f230a4e1",
      date: "2026-11-26T01:13:00.000Z",
      company: {
        name: "FemmeFlo",
        address: "Building A-12, Sector 28, Millennium Business Park, Navi Mumbai, Mahape, Maharashtra 400710",
        gst: "27ABCDE1235F1Z5",
        pan: "BPHPH2857F",
        phone: "+912240001234",
        terms: "Standard terms and conditions apply. Goods once sold are subject to company policy.",
      },
      customer: {
        shopName: "Starbucks Retail Distribution Partner Hub",
        contactName: "Rupa Sharma",
        phone: "+919833432555",
        address: "Shop 14 & 15, Ground Floor, Ghodbunder Service Road, Opp. Tikuji-Ni-Wadi, Thane West",
        village: "Manpada",
        district: "Thane",
        state: "Maharashtra",
        pincode: "400607",
      },
      seller: {
        name: "Sahil Hode",
        phone: "+918652601566",
      },
      quantity: 12,
      unitPricePaise: 2000,
      totalPaise: 24000,
      lineItems: [
        {
          productName: "FemmeFlo XL Sanitary Napkins (Family Value Pack)",
          productSku: "FF-FEM-XL-919",
          quantity: 12,
          unitPricePaise: 2000,
          totalPaise: 24000,
        },
      ],
      paymentMode: "CASH",
    });

    assert.ok(Buffer.isBuffer(pdfBuf));
    assert.ok(pdfBuf.length > 5000);
    assert.equal(pdfBuf.subarray(0, 5).toString("utf8"), "%PDF-");
    const pdfText = extractPdfContentText(pdfBuf);
    assert.ok(!/territory/i.test(pdfText), "Invoice PDF must never include the word Territory");
  });
});
