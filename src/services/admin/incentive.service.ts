import type { PrismaClient } from "../../generated/prisma/client.js";
import type { UpdateIncentiveSettingsInput } from "../../controller/incentive.validation.js";

export function createAdminIncentiveService(database: PrismaClient) {
  async function getOrCreateSettings() {
    let settings = await database.businessSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await database.businessSettings.create({
        data: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: null },
      });
    }
    return settings;
  }

  return {
    getIncentives: async () => {
      const sellers = await database.user.findMany({
        where: { role: "SELLER" },
        orderBy: { name: "asc" },
      });

      const items = await Promise.all(
        sellers.map(async (seller) => {
          const sales = await database.sale.findMany({
            where: { sellerId: seller.id, status: "CONFIRMED" },
          });

          let totalPackets = 0;
          let totalIncentivePaise = 0;

          for (const s of sales) {
            totalPackets += s.quantity;
            totalIncentivePaise += s.incentiveAmountPaise ?? 0;
          }

          return {
            seller: {
              id: seller.id,
              name: seller.name,
              phone: seller.phone,
            },
            totalConfirmedPackets: totalPackets,
            totalIncentivePaise,
            totalIncentiveRupees: totalIncentivePaise / 100,
          };
        }),
      );

      const settings = await getOrCreateSettings();

      return {
        currentRatePaise: settings.incentiveRatePaise,
        sellers: items,
      };
    },

    getSettings: async () => {
      return getOrCreateSettings();
    },

    updateSettings: async (input: UpdateIncentiveSettingsInput) => {
      await getOrCreateSettings();
      const data: Record<string, unknown> = {};
      if (input.incentiveRatePaise !== undefined) data["incentiveRatePaise"] = input.incentiveRatePaise;
      if (input.minimumPricePaise !== undefined) data["minimumPricePaise"] = input.minimumPricePaise;
      if (input.companyName !== undefined) data["companyName"] = input.companyName;
      if (input.companyGst !== undefined) data["companyGst"] = input.companyGst;
      if (input.companyAddress !== undefined) data["companyAddress"] = input.companyAddress;
      if (input.companyPhone !== undefined) data["companyPhone"] = input.companyPhone;
      if (input.companyEmail !== undefined) data["companyEmail"] = input.companyEmail;
      if (input.companyPan !== undefined) data["companyPan"] = input.companyPan;
      if (input.invoiceTerms !== undefined) data["invoiceTerms"] = input.invoiceTerms;

      return database.businessSettings.update({
        where: { id: 1 },
        data,
      });
    },
  };
}

export type AdminIncentiveService = ReturnType<typeof createAdminIncentiveService>;
