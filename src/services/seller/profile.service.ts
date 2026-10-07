import type { PrismaClient } from "../../generated/prisma/client.js";
import { HttpError } from "../../middleware/validation.js";

export type UpdateProfileInput = {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
};


export function createSellerProfileService(database: PrismaClient) {
  return {
    getProfile: async (sellerId: string) => {
      const seller = await database.user.findUnique({
        where: { id: sellerId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          active: true,
          state: true,
          district: true,
          village: true,
          createdAt: true,
          updatedAt: true,
          manager: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          stockLocation: {
            select: {
              id: true,
              name: true,
              balance: true,
            },
          },
        },
      });

      if (!seller || seller.role !== "SELLER") {
        throw new HttpError(404, "Seller profile not found");
      }

      return seller;
    },

    updateProfile: async (sellerId: string, input: UpdateProfileInput) => {
      const seller = await database.user.findUnique({ where: { id: sellerId } });
      if (!seller || seller.role !== "SELLER") {
        throw new HttpError(404, "Seller account not found");
      }

      // Check unique constraints for phone / email
      if (input.phone && input.phone !== seller.phone) {
        const existingPhone = await database.user.findUnique({ where: { phone: input.phone } });
        if (existingPhone) {
          throw new HttpError(409, "Phone number is already in use by another account");
        }
      }

      if (input.email && input.email !== seller.email) {
        const existingEmail = await database.user.findUnique({ where: { email: input.email } });
        if (existingEmail) {
          throw new HttpError(409, "Email is already in use by another account");
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData["name"] = input.name;
      if (input.phone !== undefined) updateData["phone"] = input.phone;
      if (input.email !== undefined) updateData["email"] = input.email;

      const updated = await database.user.update({
        where: { id: sellerId },
        data: updateData,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          active: true,
          state: true,
          district: true,
          village: true,
          createdAt: true,
          updatedAt: true,
          manager: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          stockLocation: {
            select: {
              id: true,
              name: true,
              balance: true,
            },
          },
        },
      });

      return updated;
    },
  };
}

export type SellerProfileService = ReturnType<typeof createSellerProfileService>;
