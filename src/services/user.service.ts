import bcrypt from "bcrypt";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { CreateManagerInput, CreateSellerInput, ListUsersInput, UpdateUserInput } from "../controller/user.validation.js";
import { HttpError } from "../middleware/validation.js";
import { publicUserSelect, type PublicUser } from "./auth/auth.types.js";

export const userListSelect = {
  ...publicUserSelect,
  createdAt: true,
  updatedAt: true,
  manager: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  stockLocation: {
    select: {
      id: true,
      balance: true,
    },
  },
  _count: {
    select: {
      sellers: true,
      customers: true,
      sales: true,
    },
  },
} as const;

type Territory = { state?: string | null | undefined; district?: string | null | undefined; village?: string | null | undefined };

export function validateTerritory(territory: Territory) {
  if (territory.district && !territory.state) throw new HttpError(400, "State is required with district");
  if (territory.village && !territory.district) throw new HttpError(400, "District is required with village");
}

export function assignedSellerScope(manager: PublicUser): Prisma.UserWhereInput {
  const scope: Prisma.UserWhereInput = { role: "SELLER", managerId: manager.id };
  for (const field of ["state", "district", "village"] as const) {
    if (manager[field]) scope[field] = { equals: manager[field], mode: "insensitive" };
  }
  return scope;
}

function sellerTerritory(input: Territory, manager: Territory) {
  const territory = { state: input.state ?? manager.state ?? null, district: input.district ?? manager.district ?? null, village: input.village ?? manager.village ?? null };
  validateTerritory(territory);
  for (const field of ["state", "district", "village"] as const) {
    if (manager[field] && manager[field]!.toLowerCase() !== territory[field]?.toLowerCase()) {
      throw new HttpError(403, "Seller territory must be within the assigned Manager's territory");
    }
  }
  return territory;
}

// Shared by Admin and Manager services so creation follows the same rules.
export async function createSeller(database: PrismaClient, input: CreateSellerInput) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  let attempts = 0;
  while (true) {
    try {
      return await database.$transaction(async (tx) => {
        const manager = await tx.user.findFirst({ where: { id: input.managerId, role: "MANAGER", active: true }, select: publicUserSelect });
        if (!manager) throw new HttpError(404, "Active Manager not found");
        const territory = sellerTerritory(input, manager);
        const seller = await tx.user.create({ data: {
          name: input.name, phone: input.phone, email: input.email ?? null,
          passwordHash, role: "SELLER", managerId: manager.id, ...territory,
        }, select: publicUserSelect });
        await tx.stockLocation.create({ data: { type: "SELLER", name: seller.name, sellerId: seller.id } });
        return seller;
      });
    } catch (error: any) {
      if (error?.code === "P2034" && attempts < 3) {
        attempts++;
        await new Promise((res) => setTimeout(res, 100 * attempts));
        continue;
      }
      throw error;
    }
  }
}

export async function createManager(database: PrismaClient, input: CreateManagerInput) {
  validateTerritory(input);
  const passwordHash = await bcrypt.hash(input.password, 12);
  return database.user.create({ data: {
    name: input.name, phone: input.phone, email: input.email ?? null, passwordHash,
    role: "MANAGER", permissions: input.permissions,
    state: input.state ?? null, district: input.district ?? null, village: input.village ?? null,
  }, select: userListSelect });
}

export async function listUsers(database: PrismaClient, scope: Prisma.UserWhereInput, query: ListUsersInput) {
  const filters: Prisma.UserWhereInput = {};
  if (query.active !== undefined) filters.active = query.active;
  if (query.managerId) filters.managerId = query.managerId;
  for (const field of ["state", "district", "village"] as const) {
    if (query[field]) filters[field] = { equals: query[field], mode: "insensitive" };
  }
  if (query.search) filters.OR = ["name", "email", "phone"].map((field) => ({ [field]: { contains: query.search, mode: "insensitive" } }));
  const where: Prisma.UserWhereInput = { AND: [scope, filters] };
  const [items, total] = await database.$transaction([
    database.user.findMany({ where, select: userListSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    database.user.count({ where }),
  ]);
  return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
}

export async function getUser(database: PrismaClient, scope: Prisma.UserWhereInput, id: string) {
  const user = await database.user.findFirst({ where: { AND: [scope, { id }] }, select: userListSelect });
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function updateUser(database: PrismaClient, role: "MANAGER" | "SELLER", id: string, input: UpdateUserInput) {
  return database.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { id, role }, select: publicUserSelect });
    if (!existing) throw new HttpError(404, "User not found");
    const updated = { ...existing, ...input };
    validateTerritory(updated);
    if (role === "SELLER" && existing.managerId) {
      const manager = await tx.user.findUnique({ where: { id: existing.managerId }, select: publicUserSelect });
      if (!manager) throw new HttpError(404, "Manager not found");
      sellerTerritory(updated, manager);
    }
    if (role === "MANAGER" && ["state", "district", "village"].some((field) => field in input)) {
      const sellers = await tx.user.findMany({ where: { managerId: id, role: "SELLER" }, select: { state: true, district: true, village: true } });
      for (const seller of sellers) {
        for (const field of ["state", "district", "village"] as const) {
          if (updated[field] && updated[field]!.toLowerCase() !== seller[field]?.toLowerCase()) {
            throw new HttpError(409, "Existing Sellers fall outside the requested Manager territory");
          }
        }
      }
    }
    const { name, phone, email, active, state, district, village } = input;
    const data: Prisma.UserUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (active !== undefined) data.active = active;
    if (state !== undefined) data.state = state;
    if (district !== undefined) data.district = district;
    if (village !== undefined) data.village = village;
    if (active !== undefined && active !== existing.active) data.tokenVersion = { increment: 1 };
    const user = await tx.user.update({ where: { id }, data, select: userListSelect });
    if (role === "SELLER" && name !== undefined) await tx.stockLocation.updateMany({ where: { sellerId: id }, data: { name } });
    return user;
  });
}
