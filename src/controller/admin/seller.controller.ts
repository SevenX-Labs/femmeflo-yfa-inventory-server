import type { RequestHandler } from "express";
import type { createAdminSellerService } from "../../services/admin/seller.service.js";
import { createSellerSchema, listUsersSchema, updateUserSchema } from "../user.validation.js";
import { idSchema, parseInput } from "../../middleware/validation.js";

export function createAdminSellerController(service: ReturnType<typeof createAdminSellerService>) {
  const create: RequestHandler = async (request, response) => {
    const user = await service.create(parseInput(createSellerSchema, request.body));
    response.status(201).json({ success: true, message: "Seller created", data: { user } });
  };
  const list: RequestHandler = async (request, response) => {
    const data = await service.list(parseInput(listUsersSchema, request.query));
    response.json({ success: true, message: "Sellers retrieved", data: { ...data, sellers: data.items } });
  };
  const get: RequestHandler = async (request, response) => {
    const user = await service.get(parseInput(idSchema, request.params.id));
    response.json({ success: true, message: "Seller retrieved", data: { user } });
  };
  const update: RequestHandler = async (request, response) => {
    const user = await service.update(parseInput(idSchema, request.params.id), parseInput(updateUserSchema, request.body));
    response.json({ success: true, message: "Seller updated", data: { user } });
  };
  return { create, list, get, update };
}
