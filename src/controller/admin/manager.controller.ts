import type { RequestHandler } from "express";
import type { createManagerService } from "../../services/admin/manager.service.js";
import { createManagerSchema, listUsersSchema, updateUserSchema } from "../user.validation.js";
import { idSchema, parseInput } from "../../middleware/validation.js";

export function createManagerController(service: ReturnType<typeof createManagerService>) {
  const create: RequestHandler = async (request, response) => {
    const user = await service.create(parseInput(createManagerSchema, request.body));
    response.status(201).json({ success: true, message: "Manager created", data: { user, manager: user } });
  };
  const list: RequestHandler = async (request, response) => {
    const data = await service.list(parseInput(listUsersSchema, request.query));
    response.json({ success: true, message: "Managers retrieved", data: { ...data, managers: data.items } });
  };
  const get: RequestHandler = async (request, response) => {
    const user = await service.get(parseInput(idSchema, request.params.id));
    response.json({ success: true, message: "Manager retrieved", data: { user, manager: user } });
  };
  const update: RequestHandler = async (request, response) => {
    const user = await service.update(parseInput(idSchema, request.params.id), parseInput(updateUserSchema, request.body));
    response.json({ success: true, message: "Manager updated", data: { user, manager: user } });
  };
  return { create, list, get, update };
}
