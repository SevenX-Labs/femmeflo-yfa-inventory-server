import type { RequestHandler } from "express";
import type { createPermissionService } from "../../services/admin/permission.service.js";
import { idSchema, parseInput } from "../../middleware/validation.js";
import { permissionsSchema } from "../user.validation.js";

export function createPermissionController(service: ReturnType<typeof createPermissionService>): RequestHandler {
  return async (request, response) => {
    const { permissions } = parseInput(permissionsSchema, request.body);
    const user = await service.update(parseInput(idSchema, request.params.id), permissions);
    response.json({ success: true, message: "Manager permissions updated", data: { user } });
  };
}
