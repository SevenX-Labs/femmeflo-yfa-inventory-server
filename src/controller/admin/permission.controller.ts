import type { Request, Response } from "express";
import type { AdminPermissionService } from "../../services/admin/permission.service.js";
import { parseInput } from "../../middleware/validation.js";
import { permissionsSchema } from "../user.validation.js";
import { z } from "zod";

const paramSchema = z.object({ id: z.uuid() });

export function createAdminPermissionController(service: AdminPermissionService) {
  return {
    list: (_request: Request, response: Response) => {
      const permissions = service.listPermissions();
      response.json({ success: true, data: { permissions } });
    },

    updateManagerPermissions: async (request: Request, response: Response) => {
      const { id } = parseInput(paramSchema, request.params);
      const { permissions } = parseInput(permissionsSchema, request.body);

      const manager = await service.updateManagerPermissions(id, permissions);
      response.json({
        success: true,
        message: "Manager permissions updated successfully",
        data: { manager },
      });
    },
  };
}

export const createPermissionController = createAdminPermissionController;
