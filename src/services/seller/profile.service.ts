import type { PrismaClient } from "../../generated/prisma/client.js";
import { HttpError } from "../../middleware/validation.js";

export type UpdateProfileInput = {
  name?: string | undefined;
  phone?: string | undefined;
  alternatePhone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  pincode?: string | undefined;
  village?: string | undefined;
  district?: string | undefined;
  state?: string | undefined;
  education?: string | undefined;
  drivingLicense?: string | undefined;
};

const sellerProfileSelect = {
  id: true,
  name: true,
  phone: true,
  alternatePhone: true,
  email: true,
  designation: true,
  employeeCode: true,
  address: true,
  pincode: true,
  aadharNumber: true,
  drivingLicense: true,
  education: true,
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
} as const;

export function createSellerProfileService(database: PrismaClient) {
  return {
    getProfile: async (sellerId: string) => {
      const seller = await database.user.findUnique({
        where: { id: sellerId },
        select: sellerProfileSelect,
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
      if (input.alternatePhone !== undefined) updateData["alternatePhone"] = input.alternatePhone;
      if (input.email !== undefined) updateData["email"] = input.email;
      if (input.address !== undefined) updateData["address"] = input.address;
      if (input.pincode !== undefined) updateData["pincode"] = input.pincode;
      if (input.village !== undefined) updateData["village"] = input.village;
      if (input.district !== undefined) updateData["district"] = input.district;
      if (input.state !== undefined) updateData["state"] = input.state;
      if (input.education !== undefined) updateData["education"] = input.education;
      if (input.drivingLicense !== undefined) updateData["drivingLicense"] = input.drivingLicense;

      const updated = await database.user.update({
        where: { id: sellerId },
        data: updateData,
        select: sellerProfileSelect,
      });

      return updated;
    },
  };
}

export type SellerProfileService = ReturnType<typeof createSellerProfileService>;
