import test from "node:test";
import assert from "node:assert/strict";
import {
  createInvoiceWithSequentialNumber,
  formatSequentialInvoiceNumber,
  getNextInvoiceSequence,
  isLegacyGeneratedInvoiceNumber,
  normalizeLegacyInvoiceNumbers,
  parseSequentialInvoiceNumber,
} from "../../src/services/invoice/invoiceNumber.js";

test("Sequential Invoice Number Unit Tests", async (t) => {
  await t.test("formatSequentialInvoiceNumber zero-pads up to 3 digits and preserves larger sequences", () => {
    assert.equal(formatSequentialInvoiceNumber(1), "INV-001");
    assert.equal(formatSequentialInvoiceNumber(9), "INV-009");
    assert.equal(formatSequentialInvoiceNumber(10), "INV-010");
    assert.equal(formatSequentialInvoiceNumber(99), "INV-099");
    assert.equal(formatSequentialInvoiceNumber(100), "INV-100");
    assert.equal(formatSequentialInvoiceNumber(1000), "INV-1000");
  });

  await t.test("parseSequentialInvoiceNumber ignores legacy timestamp and UUID invoice IDs", () => {
    assert.equal(parseSequentialInvoiceNumber("INV-001"), 1);
    assert.equal(parseSequentialInvoiceNumber("INV-042"), 42);
    assert.equal(parseSequentialInvoiceNumber("INV-1050"), 1050);
    assert.equal(parseSequentialInvoiceNumber("INV-1795675417739-628"), null);
    assert.equal(parseSequentialInvoiceNumber("INV-2026-F230A4E1"), null);
    assert.equal(parseSequentialInvoiceNumber("INV-TEST-1234"), null);
    assert.equal(isLegacyGeneratedInvoiceNumber("INV-1795675417739-628"), true);
    assert.equal(isLegacyGeneratedInvoiceNumber("INV-2026-F230A4E1"), true);
    assert.equal(isLegacyGeneratedInvoiceNumber("INV-001"), false);
    assert.equal(isLegacyGeneratedInvoiceNumber("INV-TEST-1234"), false);
  });

  await t.test("getNextInvoiceSequence starts from 1 when only legacy IDs exist and increments cleanly", async () => {
    const emptyMock = { invoice: { findMany: async () => [] } } as any;
    assert.equal(await getNextInvoiceSequence(emptyMock), 1);

    const legacyOnlyMock = {
      invoice: {
        findMany: async () => [
          { number: "INV-1795675417739-628" },
          { number: "INV-2026-F230A4E1" },
        ],
      },
    } as any;
    assert.equal(await getNextInvoiceSequence(legacyOnlyMock), 1);

    const mixedMock = {
      invoice: {
        findMany: async () => [
          { number: "INV-1795675417739-628" },
          { number: "INV-001" },
          { number: "INV-009" },
          { number: "INV-003" },
        ],
      },
    } as any;
    assert.equal(await getNextInvoiceSequence(mixedMock), 10);
  });

  await t.test("createInvoiceWithSequentialNumber starts at INV-001, locks tx, and retries on P2002", async () => {
    const records: Array<{ id: string; saleId: string; number: string; snapshot: any }> = [];
    const lockCalls: string[] = [];
    let attemptCount = 0;

    const mockClient = {
      $executeRawUnsafe: async (sql: string) => {
        lockCalls.push(sql);
      },
      invoice: {
        findMany: async () => records.map((r) => ({ number: r.number })),
        create: async ({ data }: any) => {
          attemptCount += 1;
          // Simulate unique conflict on first write of second invoice
          if (data.saleId === "sale-2" && attemptCount === 2) {
            throw { code: "P2002", meta: { target: ["number"] } };
          }
          const created = { id: `inv-${records.length + 1}`, ...data };
          records.push(created);
          return created;
        },
      },
    } as any;

    const inv1 = await createInvoiceWithSequentialNumber(mockClient, {
      saleId: "sale-1",
      buildSnapshot: (invoiceNumber) => ({ invoiceNumber, saleId: "sale-1" }),
    });
    assert.equal(inv1.number, "INV-001");
    assert.equal((inv1.snapshot as any).invoiceNumber, "INV-001");

    const inv2 = await createInvoiceWithSequentialNumber(mockClient, {
      saleId: "sale-2",
      buildSnapshot: (invoiceNumber) => ({ invoiceNumber, saleId: "sale-2" }),
    });
    // First attempt tried INV-002 (threw P2002), retry allocated INV-003 cleanly
    assert.equal(inv2.number, "INV-003");
    assert.equal((inv2.snapshot as any).invoiceNumber, "INV-003");
    assert.equal(lockCalls.length, 2);
    assert.ok(lockCalls[0]!.includes("pg_advisory_xact_lock"));
  });

  await t.test("normalizeLegacyInvoiceNumbers converts legacy generated numbers idempotently from INV-001", async () => {
    const store = [
      {
        id: "1",
        number: "INV-1795675417739-628",
        snapshot: { invoiceNumber: "INV-1795675417739-628", saleId: "s1" },
        pdfPath: "/storage/invoices/2026/11/INV-1795675417739-628.pdf",
      },
      {
        id: "2",
        number: "INV-2026-F230A4E1",
        snapshot: { invoiceNumber: "INV-2026-F230A4E1", saleId: "s2" },
        pdfPath: "/storage/invoices/2026/11/INV-2026-F230A4E1.pdf",
      },
      {
        id: "3",
        number: "INV-TEST-999",
        snapshot: { invoiceNumber: "INV-TEST-999", saleId: "s3" },
        pdfPath: null,
      },
    ];

    const mockDb = {
      $transaction: async (fn: (tx: any) => Promise<any>) =>
        fn({
          $executeRawUnsafe: async () => {},
          invoice: {
            findMany: async () => store.map((r) => ({ id: r.id, number: r.number, snapshot: r.snapshot })),
            update: async ({ where, data }: any) => {
              const target = store.find((r) => r.id === where.id)!;
              target.number = data.number;
              target.snapshot = data.snapshot;
              target.pdfPath = data.pdfPath;
              return target;
            },
          },
        }),
    } as any;

    const first = await normalizeLegacyInvoiceNumbers(mockDb);
    assert.deepEqual(first, { updated: 2, nextSequence: 3 });
    assert.equal(store[0]!.number, "INV-001");
    assert.equal(store[0]!.snapshot.invoiceNumber, "INV-001");
    assert.equal(store[1]!.number, "INV-002");
    assert.equal(store[1]!.snapshot.invoiceNumber, "INV-002");
    assert.equal(store[2]!.number, "INV-TEST-999");

    // Re-running is idempotent
    const second = await normalizeLegacyInvoiceNumbers(mockDb);
    assert.deepEqual(second, { updated: 0, nextSequence: 3 });
  });
});
