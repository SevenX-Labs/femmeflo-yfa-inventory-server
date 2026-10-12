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

export function requirePermission(permission: Permission): RequestHandler {
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

export function requireAnyPermission(permissions: Permission[]): RequestHandler {
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
    if (user.role === "MANAGER" && permissions.some((p) => user.permissions.includes(p))) {
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
