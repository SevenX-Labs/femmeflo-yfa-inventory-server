import type { RequestHandler } from "express";
import type { createManagerSellerService } from "../../services/manager/seller.service.js";
import { managerCreateSellerSchema, listUsersSchema } from "../user.validation.js";
import { idSchema, parseInput } from "../../middleware/validation.js";
import type { PublicUser } from "../../services/auth/auth.types.js";

export function createManagerSellerController(service: ReturnType<typeof createManagerSellerService>) {
  const create: RequestHandler = async (request, response) => {
    const user = await service.create(response.locals.authUser as PublicUser, parseInput(managerCreateSellerSchema, request.body));
    response.status(201).json({ success: true, message: "Seller created", data: { user } });
  };
  const list: RequestHandler = async (request, response) => {
    const data = await service.list(response.locals.authUser as PublicUser, parseInput(listUsersSchema, request.query));
    response.json({ success: true, message: "Assigned Sellers retrieved", data });
  };
  const get: RequestHandler = async (request, response) => {
    const user = await service.get(response.locals.authUser as PublicUser, parseInput(idSchema, request.params.id));
    response.json({ success: true, message: "Assigned Seller retrieved", data: { user } });
  };
  return { create, list, get };
}
