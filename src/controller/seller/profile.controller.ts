import type { Request, Response } from "express";
import type { SellerProfileService } from "../../services/seller/profile.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, emailSchema, phoneSchema } from "../../middleware/validation.js";
import { z } from "zod";

const location = z.string().trim().min(1).max(100);
const pincodeRegex = /^[1-9][0-9]{5}$/;

const updateProfileSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  alternatePhone: phoneSchema.optional(),
  email: emailSchema.optional(),
  address: z.string().trim().max(500).optional(),
  pincode: z.string().trim().regex(pincodeRegex, "Pincode must be 6 digits").optional().or(z.literal("")),
  village: location.optional(),
  district: location.optional(),
  state: location.optional(),
  education: z.string().trim().max(100).optional().or(z.literal("")),
  drivingLicense: z.string().trim().max(50).optional().or(z.literal("")),
}).refine((data) => Object.keys(data).length > 0, "Provide at least one field to update")
  .refine((data) => {
    if (data.phone && data.alternatePhone) {
      const p1 = data.phone.replace(/\D/g, "").slice(-10);
      const p2 = data.alternatePhone.replace(/\D/g, "").slice(-10);
      if (p1 && p2 && p1 === p2) return false;
    }
    return true;
  }, {
    message: "Alternate phone number cannot be the same as primary phone number",
    path: ["alternatePhone"],
  });

export function createSellerProfileController(service: SellerProfileService) {
  return {
    getProfile: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const profile = await service.getProfile(user.id);
      response.json({
        success: true,
        data: { profile, user: profile },
      });
    },

    updateProfile: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(updateProfileSchema, request.body);
      const profile = await service.updateProfile(user.id, input);
      response.json({
        success: true,
        message: "Profile updated successfully",
        data: { profile, user: profile },
      });
    },
  };
}
