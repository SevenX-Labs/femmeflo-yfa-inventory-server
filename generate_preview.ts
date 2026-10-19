import { generateInvoicePdfBuffer, type InvoiceSnapshot } from "./src/services/pdf.service.js";
import fs from "fs";

const sampleSnapshot: InvoiceSnapshot = {
  invoiceNumber: "INV-1792412021547-892",
  saleId: "test-sale-id",
  date: new Date().toISOString(),
  company: {
    name: "MASAKO ENTERPRISES PRIVATE LIMITED",
    gst: "27AATCM9117G1ZZ",
    pan: "AATCM9117G",
    address: "207 Building No 1 Millennium Business Park Sector-2 Mahape Navi Mumbai 400710",
    phone: "+919399123750",
    email: "info@femmeflo.com",
    terms: "Thank you for partnering with FemmeFlo!",
  },
  customer: {
    shopName: "ABC",
    contactName: "Guptaji",
    phone: "+918080506189",
    state: "Maharashtra",
    district: "Konkan Division",
    village: "Mahape",
  },
  seller: {
    name: "Thanendra Thakur",
    phone: "+919399123750",
  },
  quantity: 1,
  unitPricePaise: 2500,
  totalPaise: 2500,
  paymentMode: "CASH",
};

async function run() {
  const buf = await generateInvoicePdfBuffer(sampleSnapshot);
  fs.writeFileSync("test_output.pdf", buf);
  console.log("PDF written to test_output.pdf");
}

run();
