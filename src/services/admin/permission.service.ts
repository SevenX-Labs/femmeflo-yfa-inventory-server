import type { PrismaClient } from "../../generated/prisma/client.js";
import { ALL_PERMISSIONS } from "../../constants/permissions.js";
import { HttpError } from "../../middleware/validation.js";

export function createAdminPermissionService(database: PrismaClient) {
  return {
    listPermissions: () => {
      return ALL_PERMISSIONS;
    },

    updateManagerPermissions: async (managerId: string, permissions: string[]) => {
      const manager = await database.user.findUnique({
        where: { id: managerId },
      });

      if (!manager) {
        throw new HttpError(404, "Manager not found");
      }

      if (manager.role !== "MANAGER") {
        throw new HttpError(400, "Target user is not a Manager");
      }

      // Deduplicate permissions
      const uniquePermissions = Array.from(new Set(permissions));

      const updated = await database.user.update({
        where: { id: managerId },
        data: { permissions: uniquePermissions },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          permissions: true,
          updatedAt: true,
        },
      });

      return updated;
    },

    updateOverallPermissions: async (permissions: string[]) => {
      const uniquePermissions = Array.from(new Set(permissions));

      const result = await database.user.updateMany({
        where: { role: "MANAGER" },
        data: { permissions: uniquePermissions },
      });

      const managers = await database.user.findMany({
        where: { role: "MANAGER" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          permissions: true,
          updatedAt: true,
        },
      });

      return { count: result.count, permissions: uniquePermissions, managers };
    },
  };
}

export type AdminPermissionService = ReturnType<typeof createAdminPermissionService>;
export const createPermissionService = createAdminPermissionService;
