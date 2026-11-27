import type { Invoice, Prisma, PrismaClient } from "../../generated/prisma/client.js";

const INVOICE_NUMBER_PREFIX = "INV-";
const MIN_SEQUENCE_DIGITS = 3;
const SEQUENTIAL_INVOICE_REGEX = /^INV-(\d{1,7})$/;
const LEGACY_GENERATED_INVOICE_REGEX = /^INV-(?:\d{10,}-\d+|\d{4}-[0-9A-F]{8})$/i;
const INVOICE_SEQUENCE_LOCK_KEY = 789012;

type InvoiceTransactionClient = Pick<PrismaClient, "invoice"> & {
  $executeRawUnsafe?: (query: string, ...values: unknown[]) => Promise<unknown>;
};

export interface CreateSequentialInvoiceOptions<
  TInclude extends Prisma.InvoiceInclude | undefined = undefined
> {
  saleId: string;
  buildSnapshot: (invoiceNumber: string) => Record<string, unknown>;
  include?: TInclude;
  maxAttempts?: number;
}

/**
 * Formats a positive integer sequence into the standard zero-padded invoice code (`INV-001`).
 */
export function formatSequentialInvoiceNumber(sequence: number): string {
  const safeSequence = Number.isFinite(sequence) && sequence >= 1 ? Math.floor(sequence) : 1;
  return `${INVOICE_NUMBER_PREFIX}${String(safeSequence).padStart(MIN_SEQUENCE_DIGITS, "0")}`;
}

/**
 * Extracts the numeric sequence from sequential invoice numbers (`INV-001`),
 * ignoring legacy epoch-timestamp (`INV-1795...-...`) or UUID-based invoice numbers.
 */
export function parseSequentialInvoiceNumber(value?: string | null): number | null {
  if (!value) return null;
  const match = SEQUENTIAL_INVOICE_REGEX.exec(value.trim());
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Identifies legacy auto-generated invoice numbers so startup normalization
 * can renumber only legacy generated rows without touching custom or test IDs.
 */
export function isLegacyGeneratedInvoiceNumber(value?: string | null): boolean {
  if (!value) return false;
  return LEGACY_GENERATED_INVOICE_REGEX.test(value.trim());
}

async function acquireInvoiceSequenceLock(client: InvoiceTransactionClient): Promise<void> {
  if (typeof client.$executeRawUnsafe === "function") {
    await client.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${INVOICE_SEQUENCE_LOCK_KEY})`);
  }
}

/**
 * Computes the next sequential integer ID after the highest sequential `INV-NNN` record.
 */
export async function getNextInvoiceSequence(client: InvoiceTransactionClient): Promise<number> {
  if (typeof client.invoice?.findMany !== "function") {
    return 1;
  }
  const existing = await client.invoice.findMany({
    where: { number: { startsWith: INVOICE_NUMBER_PREFIX } },
    select: { number: true },
  });

  let maxSequence = 0;
  for (const row of existing) {
    const parsed = parseSequentialInvoiceNumber(row.number);
    if (parsed !== null && parsed > maxSequence) {
      maxSequence = parsed;
    }
  }
  return maxSequence + 1;
}

function isInvoiceNumberConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; meta?: { target?: unknown } };
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  if (!target) return true;
  if (Array.isArray(target)) return target.includes("number");
  return String(target).includes("number");
}

/**
 * Allocates the next `INV-001`-style sequential number and persists the Invoice row,
 * holding a PostgreSQL transaction advisory lock when available and retrying on `P2002`.
 */
export async function createInvoiceWithSequentialNumber<
  TInclude extends Prisma.InvoiceInclude | undefined = undefined
>(
  client: InvoiceTransactionClient,
  options: CreateSequentialInvoiceOptions<TInclude>
): Promise<
  TInclude extends Prisma.InvoiceInclude
    ? Prisma.InvoiceGetPayload<{ include: TInclude }>
    : Invoice
> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 8);
  await acquireInvoiceSequenceLock(client);
  const startingSequence = await getNextInvoiceSequence(client);

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const invoiceNumber = formatSequentialInvoiceNumber(startingSequence + attempt);
    const snapshot = options.buildSnapshot(invoiceNumber);
    try {
      const createArgs: Prisma.InvoiceCreateArgs = {
        data: {
          saleId: options.saleId,
          number: invoiceNumber,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      };
      if (options.include) {
        createArgs.include = options.include;
      }
      return (await client.invoice.create(createArgs)) as any;
    } catch (error) {
      if (isInvoiceNumberConflictError(error) && attempt < maxAttempts - 1) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Failed to allocate sequential invoice number.");
}

/**
 * Idempotently converts legacy timestamp/UUID invoice numbers (`INV-1795...-...`,
 * `INV-2026-XXXXXXXX`) into sequential `INV-001`-style numbers ordered chronologically.
 */
export async function normalizeLegacyInvoiceNumbers(
  database: PrismaClient
): Promise<{ updated: number; nextSequence: number }> {
  return database.$transaction(async (tx) => {
    await acquireInvoiceSequenceLock(tx);

    const invoices = await tx.invoice.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, number: true, snapshot: true },
    });

    const usedNumbers = new Set<string>();
    let maxSequence = 0;
    for (const inv of invoices) {
      usedNumbers.add(inv.number);
      const parsed = parseSequentialInvoiceNumber(inv.number);
      if (parsed !== null && parsed > maxSequence) {
        maxSequence = parsed;
      }
    }

    let nextSeq = maxSequence + 1;
    let updated = 0;

    for (const inv of invoices) {
      if (!isLegacyGeneratedInvoiceNumber(inv.number)) {
        continue;
      }

      let candidate = formatSequentialInvoiceNumber(nextSeq);
      while (usedNumbers.has(candidate)) {
        nextSeq += 1;
        candidate = formatSequentialInvoiceNumber(nextSeq);
      }

      usedNumbers.delete(inv.number);
      usedNumbers.add(candidate);
      nextSeq += 1;

      const existingSnapshot =
        inv.snapshot && typeof inv.snapshot === "object" && !Array.isArray(inv.snapshot)
          ? (inv.snapshot as Record<string, unknown>)
          : {};

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          number: candidate,
          snapshot: { ...existingSnapshot, invoiceNumber: candidate } as Prisma.InputJsonValue,
          pdfPath: null,
        },
      });
      updated += 1;
    }

    return { updated, nextSequence: nextSeq };
  });
}
