import type { Request, Response } from "express";
import type { SellerProfileService } from "../../services/seller/profile.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, emailSchema, phoneSchema } from "../../middleware/validation.js";
import { z } from "zod";

const updateProfileSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
}).refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");

export function createSellerProfileController(service: SellerProfileService) {
  return {
    getProfile: async (_request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const profile = await service.getProfile(user.id);
      response.json({
        success: true,
        data: { profile },
      });
    },

    updateProfile: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(updateProfileSchema, request.body);
      const profile = await service.updateProfile(user.id, input);
      response.json({
        success: true,
        message: "Profile updated successfully",
        data: { profile },
      });
    },
  };
}

