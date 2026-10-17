import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type { CreateCustomerInput, ListCustomersInput, UpdateCustomerInput } from "../controller/customer.validation.js";
import { HttpError } from "../middleware/validation.js";
import { uploadCustomerPhoto } from "./storage.service.js";

export type UserContext = {
  id: string;
  role: "SUPER_ADMIN" | "MANAGER" | "SELLER";
  managerId?: string | null;
  state?: string | null;
  district?: string | null;
  village?: string | null;
};

export function createCustomerService(database: PrismaClient) {
  return {
    create: async (user: UserContext, input: CreateCustomerInput) => {
      // 1. Validate Category exists and is active
      const category = await database.category.findUnique({ where: { id: input.categoryId } });
      if (!category || !category.active) {
        throw new HttpError(400, "Invalid or inactive category ID");
      }

      // Check duplicate phone number
      const existingCustomer = await database.customer.findFirst({
        where: { phone: input.phone },
        select: { id: true, shopName: true, phone: true },
      });
      if (existingCustomer) {
        throw new HttpError(409, `A shopkeeper with this phone number (${input.phone}) already exists: ${existingCustomer.shopName}`);
      }

      // 2. Determine sellerId based on user role
      let assignedSellerId: string;
      if (user.role === "SELLER") {
        assignedSellerId = user.id;
      } else if (input.sellerId) {
        // Verify seller exists and is active
        const seller = await database.user.findUnique({ where: { id: input.sellerId } });
        if (!seller || seller.role !== "SELLER" || !seller.active) {
          throw new HttpError(400, "Invalid or inactive seller ID");
        }
        // If Manager, ensure seller is assigned to this Manager
        if (user.role === "MANAGER" && seller.managerId !== user.id) {
          throw new HttpError(403, "Seller is not assigned to you");
        }
        assignedSellerId = input.sellerId;
      } else if (user.role === "MANAGER") {
        assignedSellerId = user.id;
      } else {
        throw new HttpError(400, "sellerId is required when onboarding customer as Admin");
      }

      const data: Record<string, unknown> = {
        shopName: input.shopName,
        contactName: input.contactName,
        phone: input.phone,
        categoryId: input.categoryId,
        sellerId: assignedSellerId,
        createdById: user.id,
        shopNumber: input.shopNumber,
        streetName: input.streetName,
        pincode: input.pincode,
        address: input.address,
        state: input.state,
        district: input.district,
        village: input.village,
      };

      if (input.email !== undefined) data["email"] = input.email;
      if (input.photoPath !== undefined) data["photoPath"] = input.photoPath;
      if (input.latitude !== undefined) data["latitude"] = new Prisma.Decimal(input.latitude);
      if (input.longitude !== undefined) data["longitude"] = new Prisma.Decimal(input.longitude);

      const customer = await database.customer.create({
        data: data as Prisma.CustomerCreateInput,
        include: {
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true, phone: true } },
        },
      });

      const fullAddress = [
        input.shopNumber,
        input.streetName,
        input.village,
        input.district,
        input.state,
        input.pincode,
      ].filter(Boolean).join(", ");

      return {
        ...customer,
        shopNumber: input.shopNumber,
        streetName: input.streetName,
        pincode: input.pincode,
        address: fullAddress || `${customer.village}, ${customer.district}, ${customer.state}`,
      };
    },

    lookupPincode: async (pincode: string) => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const json = (await res.json()) as Array<{
            Status: string;
            PostOffice?: Array<{
              Name: string;
              District: string;
              State: string;
            }>;
          }>;

          if (Array.isArray(json) && json[0]?.Status === "Success" && json[0].PostOffice && json[0].PostOffice.length > 0) {
            const poList = json[0].PostOffice;
            const firstPo = poList[0];
            const state = firstPo?.State || "";
            const district = firstPo?.District || "";
            const villages = Array.from(new Set(poList.map((p) => p.Name).filter(Boolean)));
            const village = villages[0] || "";

            return {
              pincode,
              state,
              district,
              village,
              villages,
            };
          }
        }
      } catch (err) {
        console.warn("Pincode lookup error:", err);
      }
      return {
        pincode,
        state: "",
        district: "",
        village: "",
        villages: [],
      };
    },

    list: async (user: UserContext, query: ListCustomersInput) => {
      const where: Prisma.CustomerWhereInput = {};

      if (query.active !== undefined) where.active = query.active;
      if (query.categoryId) where.categoryId = query.categoryId;

      // Search across shopName, contactName, phone
      if (query.search) {
        where.OR = [
          { shopName: { contains: query.search, mode: "insensitive" } },
          { contactName: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search } },
        ];
      }

      // Geographic filters
      if (query.state) where.state = { equals: query.state, mode: "insensitive" };
      if (query.district) where.district = { equals: query.district, mode: "insensitive" };
      if (query.village) where.village = { equals: query.village, mode: "insensitive" };
      if (query.pincode) where.pincode = query.pincode;

      // Role scoping
      if (user.role === "SELLER") {
        where.sellerId = user.id;
      } else if (user.role === "MANAGER") {
        const managerWhere: Prisma.CustomerWhereInput = { seller: { managerId: user.id } };
        if (user.state) managerWhere.state = { equals: user.state, mode: "insensitive" };
        if (user.district) managerWhere.district = { equals: user.district, mode: "insensitive" };
        if (user.village) managerWhere.village = { equals: user.village, mode: "insensitive" };

        if (query.sellerId) {
          where.AND = [managerWhere, { sellerId: query.sellerId }];
        } else {
          where.AND = [managerWhere];
        }
      } else if (query.sellerId) {
        where.sellerId = query.sellerId;
      }

      const total = await database.customer.count({ where });
      const totalPages = Math.ceil(total / query.pageSize);
      const items = await database.customer.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true, phone: true } },
        },
      });

      return {
        items,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: totalPages === 0 && total === 0 ? 0 : Math.max(1, totalPages),
        },
      };
    },

    get: async (user: UserContext, id: string) => {
      const customer = await database.customer.findUnique({
        where: { id },
        include: {
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true, phone: true, managerId: true } },
        },
      });

      if (!customer) {
        throw new HttpError(404, "Customer not found");
      }

      // Check role authorization
      if (user.role === "SELLER" && customer.sellerId !== user.id) {
        throw new HttpError(404, "Customer not found or outside assigned scope");
      }
      if (user.role === "MANAGER") {
        if (customer.seller.managerId !== user.id) {
          throw new HttpError(404, "Customer not found or outside assigned scope");
        }
        if (user.state && customer.state.toLowerCase() !== user.state.toLowerCase()) {
          throw new HttpError(404, "Customer not found or outside assigned scope");
        }
        if (user.district && customer.district.toLowerCase() !== user.district.toLowerCase()) {
          throw new HttpError(404, "Customer not found or outside assigned scope");
        }
        if (user.village && customer.village && customer.village.toLowerCase() !== user.village.toLowerCase()) {
          throw new HttpError(404, "Customer not found or outside assigned scope");
        }
      }

      return customer;
    },

    update: async (user: UserContext, id: string, input: UpdateCustomerInput) => {
      const existing = await database.customer.findUnique({
        where: { id },
        include: { seller: { select: { id: true, managerId: true } } },
      });

      if (!existing) {
        throw new HttpError(404, "Customer not found");
      }

      if (user.role === "SELLER" && existing.sellerId !== user.id) {
        throw new HttpError(404, "Customer not found or outside assigned scope");
      }
      if (user.role === "MANAGER" && existing.seller.managerId !== user.id) {
        throw new HttpError(404, "Customer not found or outside assigned scope");
      }

      if (input.categoryId) {
        const category = await database.category.findUnique({ where: { id: input.categoryId } });
        if (!category || !category.active) {
          throw new HttpError(400, "Invalid or inactive category ID");
        }
      }

      if (input.sellerId && input.sellerId !== existing.sellerId) {
        if (user.role === "SELLER") {
          throw new HttpError(403, "Sellers cannot reassign customer ownership");
        }
        const seller = await database.user.findUnique({ where: { id: input.sellerId } });
        if (!seller || seller.role !== "SELLER" || !seller.active) {
          throw new HttpError(400, "Invalid or inactive seller ID");
        }
        if (user.role === "MANAGER" && seller.managerId !== user.id) {
          throw new HttpError(403, "Target seller is not assigned to you");
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.shopName !== undefined) updateData["shopName"] = input.shopName;
      if (input.contactName !== undefined) updateData["contactName"] = input.contactName;
      if (input.phone !== undefined && input.phone !== existing.phone) {
        const duplicate = await database.customer.findFirst({
          where: { phone: input.phone, id: { not: id } },
          select: { id: true, shopName: true },
        });
        if (duplicate) {
          throw new HttpError(409, `Another shopkeeper with this phone number (${input.phone}) already exists: ${duplicate.shopName}`);
        }
        updateData["phone"] = input.phone;
      }
      if (input.email !== undefined) updateData["email"] = input.email;
      if (input.categoryId !== undefined) updateData["categoryId"] = input.categoryId;
      if (input.sellerId !== undefined) updateData["sellerId"] = input.sellerId;
      if (input.shopNumber !== undefined) updateData["shopNumber"] = input.shopNumber;
      if (input.streetName !== undefined) updateData["streetName"] = input.streetName;
      if (input.pincode !== undefined) updateData["pincode"] = input.pincode;
      if (input.address !== undefined) updateData["address"] = input.address;
      if (input.state !== undefined) updateData["state"] = input.state;
      if (input.district !== undefined) updateData["district"] = input.district;
      if (input.village !== undefined) updateData["village"] = input.village;
      if (input.photoPath !== undefined) updateData["photoPath"] = input.photoPath;
      if (input.active !== undefined) updateData["active"] = input.active;
      if (input.latitude !== undefined) updateData["latitude"] = new Prisma.Decimal(input.latitude);
      if (input.longitude !== undefined) updateData["longitude"] = new Prisma.Decimal(input.longitude);

      return database.customer.update({
        where: { id },
        data: updateData as Prisma.CustomerUpdateInput,
        include: {
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true, phone: true } },
        },
      });
    },

    uploadPhoto: async (user: UserContext, id: string, file: Express.Multer.File) => {
      const existing = await database.customer.findUnique({
        where: { id },
        include: { seller: { select: { id: true, managerId: true } } },
      });

      if (!existing) {
        throw new HttpError(404, "Customer not found");
      }

      if (user.role === "SELLER" && existing.sellerId !== user.id) {
        throw new HttpError(403, "Customer is not assigned to you");
      }
      if (user.role === "MANAGER" && existing.seller.managerId !== user.id) {
        throw new HttpError(403, "Customer is not under your assigned sellers");
      }

      const uploadResult = await uploadCustomerPhoto(id, file.buffer, file.mimetype, existing.photoPath);

      const customer = await database.customer.update({
        where: { id },
        data: { photoPath: uploadResult.publicUrl },
        include: {
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true, phone: true } },
        },
      });

      return { customer, photoUrl: uploadResult.publicUrl };
    },
  };
}

export type CustomerService = ReturnType<typeof createCustomerService>;
