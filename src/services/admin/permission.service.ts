import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ManagerPermission } from "../../middleware/rbac.middleware.js";
import { HttpError } from "../../middleware/validation.js";
import { publicUserSelect } from "../auth/auth.types.js";

export function createPermissionService(database: PrismaClient) {
  return {
    async update(id: string, permissions: ManagerPermission[]) {
      return database.$transaction(async (tx) => {
        const manager = await tx.user.findFirst({ where: { id, role: "MANAGER" } });
        if (!manager) throw new HttpError(404, "Manager not found");
        return tx.user.update({ where: { id }, data: { permissions }, select: publicUserSelect });
      });
    },
  };
}
