import type { RequestHandler } from "express";
import type { PublicUser, Role } from "../services/auth/auth.types.js";
import { ALL_PERMISSIONS, type Permission } from "../constants/permissions.js";

export const managerPermissions = ALL_PERMISSIONS;
export type ManagerPermission = Permission;

export type SupportedRole = Role | "Admin" | "Manager" | "Seller";

function normalizeRole(role: SupportedRole): Role {
  if (role === "Admin") return "SUPER_ADMIN";
  if (role === "Manager") return "MANAGER";
  if (role === "Seller") return "SELLER";
  return role;
}

const PERMISSION_ALIASES: Record<string, string[]> = {
  onboard_customers: ["onboard_customers", "CUSTOMER_CREATE"],
  CUSTOMER_CREATE: ["onboard_customers", "CUSTOMER_CREATE"],
  view_customers: ["view_customers", "CUSTOMER_READ", "onboard_customers", "CUSTOMER_CREATE"],
  CUSTOMER_READ: ["view_customers", "CUSTOMER_READ", "onboard_customers", "CUSTOMER_CREATE"],
  manage_sellers: ["manage_sellers", "SELLER_CREATE", "SELLER_READ", "SELLER_UPDATE"],
  SELLER_UPDATE: ["manage_sellers", "SELLER_UPDATE", "SELLER_CREATE"],
  SELLER_CREATE: ["manage_sellers", "SELLER_CREATE", "SELLER_READ"],
  SELLER_READ: ["manage_sellers", "SELLER_READ", "SELLER_CREATE"],
  view_inventory: ["view_inventory", "INVENTORY_READ"],
  INVENTORY_READ: ["view_inventory", "INVENTORY_READ"],
  transfer_inventory: ["transfer_inventory"],
  approve_sales: ["approve_sales", "SALES_READ"],
  SALES_READ: ["approve_sales", "SALES_READ"],
  view_reports: ["view_reports"],
  manage_managers: ["manage_managers"],
  manage_permissions: ["manage_permissions"],
};

export function userHasPermission(userPermissions: string[] | undefined, required: string): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  if (userPermissions.includes(required)) return true;
  const aliases = PERMISSION_ALIASES[required];
  if (aliases && aliases.some((alias) => userPermissions.includes(alias))) {
    return true;
  }
  return false;
}

export function requirePermission(permission: Permission): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.authUser as PublicUser | undefined;
    if (!user) {
      response.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    if (user.role === "SUPER_ADMIN") {
      next();
      return;
    }
    if (user.role === "MANAGER" && userHasPermission(user.permissions, permission)) {
      next();
      return;
    }
    response.status(403).json({ success: false, message: "Permission denied" });
  };
}

export function requireAnyPermission(permissions: (Permission | string)[]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.authUser as PublicUser | undefined;
    if (!user) {
      response.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    if (user.role === "SUPER_ADMIN") {
      next();
      return;
    }
    if (user.role === "MANAGER" && permissions.some((p) => userHasPermission(user.permissions, p))) {
      next();
      return;
    }
    response.status(403).json({ success: false, message: "Permission denied" });
  };
}

export function requireRole(...roles: SupportedRole[]): RequestHandler {
  const normalized = roles.map(normalizeRole);
  return (_request, response, next) => {
    const user = response.locals.authUser as PublicUser | undefined;
    if (!user) {
      response.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    if (!normalized.includes(user.role)) {
      response.status(403).json({ success: false, message: "Access denied" });
      return;
    }
    next();
  };
}

export const authorize = requireRole;
