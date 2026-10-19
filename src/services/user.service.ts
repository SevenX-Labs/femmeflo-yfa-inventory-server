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
      employeeCode: true,
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

function cleanStr(val?: string | null): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateTerritory(territory: Territory) {
  const state = cleanStr(territory.state);
  const district = cleanStr(territory.district);
  const village = cleanStr(territory.village);
  if (district && !state) throw new HttpError(400, "State is required with district");
  if (village && !district) throw new HttpError(400, "District is required with village");
}

export function assignedSellerScope(manager: PublicUser): Prisma.UserWhereInput {
  return { role: "SELLER", managerId: manager.id };
}

function sellerTerritory(input: Territory, manager: Territory) {
  // No strict territory matching required - seller is simply assigned under the manager.
  // Preserve whatever state, district, and village the seller provides, or fallback to manager if blank.
  const sState = cleanStr(input.state) ?? cleanStr(manager.state);
  const sDistrict = cleanStr(input.district) ?? cleanStr(manager.district);
  const sVillage = cleanStr(input.village);

  const territory = {
    state: sState,
    district: sDistrict,
    village: sVillage,
  };
  validateTerritory(territory);

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
          name: input.name.trim(),
          phone: input.phone,
          alternatePhone: cleanStr(input.alternatePhone),
          email: cleanStr(input.email),
          designation: cleanStr(input.designation),
          employeeCode: cleanStr(input.employeeCode),
          address: cleanStr(input.address),
          pincode: cleanStr(input.pincode),
          aadharNumber: cleanStr(input.aadharNumber),
          drivingLicense: cleanStr(input.drivingLicense),
          education: cleanStr(input.education),
          active: input.active !== undefined ? input.active : true,
          passwordHash,
          role: "SELLER",
          managerId: manager.id,
          ...territory,
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
  const employeeCode = cleanStr(input.employeeCode);
  return database.user.create({
    data: {
      name: input.name.trim(),
      phone: input.phone,
      alternatePhone: cleanStr(input.alternatePhone),
      email: cleanStr(input.email),
      employeeCode,
      designation: cleanStr(input.designation) || "Regional Manager",
      address: cleanStr(input.address),
      pincode: cleanStr(input.pincode),
      aadharNumber: cleanStr(input.aadharNumber),
      drivingLicense: cleanStr(input.drivingLicense),
      education: cleanStr(input.education),
      passwordHash,
      role: "MANAGER",
      permissions: input.permissions,
      state: cleanStr(input.state),
      district: cleanStr(input.district),
      village: cleanStr(input.village),
    },
    select: userListSelect,
  });
}

export async function listUsers(database: PrismaClient, scope: Prisma.UserWhereInput, query: ListUsersInput) {
  const filters: Prisma.UserWhereInput = {};
  if (query.active !== undefined) filters.active = query.active;
  if (query.managerId) filters.managerId = query.managerId;
  for (const field of ["state", "district", "village"] as const) {
    if (query[field]) filters[field] = { equals: query[field], mode: "insensitive" };
  }
  if (query.search) filters.OR = ["name", "email", "phone", "employeeCode", "designation"].map((field) => ({ [field]: { contains: query.search, mode: "insensitive" } }));
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

export async function updateUser(database: PrismaClient, roleOrScope: "MANAGER" | "SELLER" | Prisma.UserWhereInput, id: string, input: UpdateUserInput) {
  const scope: Prisma.UserWhereInput = typeof roleOrScope === "string" ? { role: roleOrScope } : roleOrScope;
  return database.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { AND: [scope, { id }] }, select: publicUserSelect });
    const role = existing?.role;
    if (!existing) throw new HttpError(404, "User not found");
    const updated = { ...existing, ...input };
    validateTerritory(updated);
    const targetManagerId = input.managerId !== undefined ? input.managerId : existing.managerId;
    if (role === "SELLER" && targetManagerId) {
      const manager = await tx.user.findUnique({ where: { id: targetManagerId }, select: publicUserSelect });
      if (!manager) throw new HttpError(404, "Manager not found");
      sellerTerritory(updated, manager);
    }
    if (role === "MANAGER" && ["state", "district"].some((field) => field in input)) {
      // Territory matching removed: manager territory can be updated without restricting assigned sellers
    }
    const {
      name, phone, alternatePhone, email, active, state, district, village,
      designation, employeeCode, address, pincode, aadharNumber, drivingLicense, education, managerId
    } = input;
    const data: Prisma.UserUpdateInput = {};
    if (name !== undefined) data.name = name.trim();
    if (phone !== undefined) data.phone = phone;
    if (alternatePhone !== undefined) data.alternatePhone = cleanStr(alternatePhone);
    if (email !== undefined) data.email = cleanStr(email);
    if (active !== undefined) data.active = active;
    if (state !== undefined) data.state = cleanStr(state);
    if (district !== undefined) data.district = cleanStr(district);
    if (village !== undefined) data.village = cleanStr(village);
    if (designation !== undefined) data.designation = cleanStr(designation);
    if (employeeCode !== undefined) data.employeeCode = cleanStr(employeeCode);
    if (address !== undefined) data.address = cleanStr(address);
    if (pincode !== undefined) data.pincode = cleanStr(pincode);
    if (aadharNumber !== undefined) data.aadharNumber = cleanStr(aadharNumber);
    if (drivingLicense !== undefined) data.drivingLicense = cleanStr(drivingLicense);
    if (education !== undefined) data.education = cleanStr(education);
    if (managerId !== undefined && role === "SELLER") {
      data.manager = managerId ? { connect: { id: managerId } } : { disconnect: true };
    }
    if (active !== undefined && active !== existing.active) data.tokenVersion = { increment: 1 };
    const user = await tx.user.update({ where: { id }, data, select: userListSelect });
    if (role === "SELLER" && name !== undefined) await tx.stockLocation.updateMany({ where: { sellerId: id }, data: { name: name.trim() } });
    return user;
  });
}
