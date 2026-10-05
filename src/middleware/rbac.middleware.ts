import type { RequestHandler } from "express";
import type { PublicUser, Role } from "../services/auth/auth.types.js";

export const managerPermissions = ["SELLER_READ", "SELLER_CREATE", "CUSTOMER_READ", "CUSTOMER_CREATE", "SALES_READ", "INVENTORY_READ"] as const;
export type ManagerPermission = typeof managerPermissions[number];

export function requirePermission(permission: ManagerPermission): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.authUser as PublicUser | undefined;
    if (!user) {
      response.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    if (user.role !== "SUPER_ADMIN" && (user.role !== "MANAGER" || !user.permissions.includes(permission))) {
      response.status(403).json({ success: false, message: "Permission denied" });
      return;
    }
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.authUser as PublicUser | undefined;
    if (!user) {
      response.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    if (!roles.includes(user.role)) {
      response.status(403).json({ success: false, message: "Access denied" });
      return;
    }
    next();
  };
}
