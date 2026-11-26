import type { PrismaClient, Prisma } from "../generated/prisma/client.js";

export type BusinessSettingsRecord = {
  id: number;
  minimumPricePaise: number;
  incentiveRatePaise: number | null;
  companyName: string | null;
  companyGst: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyPan: string | null;
  invoiceTerms: string | null;
  defaultProductId: string | null;
  updatedAt: Date;
};

export const DEFAULT_INCENTIVE_RATE_PAISE = 100; // ₹1.00 per packet default

let cachedSettings: BusinessSettingsRecord | null = null;
let cacheExpiresAt = 0;
const SETTINGS_CACHE_TTL_MS = 60_000; // 60 seconds cache

export async function getCachedBusinessSettings(
  database: PrismaClient | Prisma.TransactionClient | { businessSettings: any }
): Promise<BusinessSettingsRecord> {
  const now = Date.now();
  if (cachedSettings && cacheExpiresAt > now) {
    return cachedSettings;
  }

  let settings = await database.businessSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await database.businessSettings.create({
      data: {
        id: 1,
        minimumPricePaise: 2500,
        incentiveRatePaise: DEFAULT_INCENTIVE_RATE_PAISE,
        companyName: "MASAKO ENTERPRISES PRIVATE LIMITED",
      },
    });
  }

  const normalized: BusinessSettingsRecord = {
    ...settings,
    incentiveRatePaise: settings.incentiveRatePaise ?? DEFAULT_INCENTIVE_RATE_PAISE,
  };

  cachedSettings = normalized;
  cacheExpiresAt = now + SETTINGS_CACHE_TTL_MS;
  return normalized;
}

export function invalidateBusinessSettingsCache(): void {
  cachedSettings = null;
  cacheExpiresAt = 0;
}
