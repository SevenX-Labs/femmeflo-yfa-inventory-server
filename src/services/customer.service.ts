import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
  import type { CreateBulkCustomersInput, CreateCustomerInput, ListCustomersInput, UpdateCustomerInput } from "../controller/customer.validation.js";
import { HttpError } from "../middleware/validation.js";
import { uploadCustomerPhoto } from "./storage.service.js";
import { forwardGeocode, isGpsAccuracyPoor, buildAddressQuery } from "./geocoding.service.js";
import { istToUtcDate } from "../utils/timezone.utils.js";

export type UserContext = {
  id: string;
  role: "SUPER_ADMIN" | "MANAGER" | "SELLER";
  managerId?: string | null;
  state?: string | null;
  district?: string | null;
  village?: string | null;
  isSeller?: boolean;
};

export function formatISTDetails(dateInput: unknown) {
  if (!dateInput) return null;
  const d = new Date(dateInput as string | number | Date);
  if (Number.isNaN(d.getTime())) return null;

  // Asia/Kolkata is UTC+05:30 (19,800,000 ms)
  const istMs = d.getTime() + 19800000;
  const istDate = new Date(istMs);

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = istDate.getUTCFullYear();
  const month = pad(istDate.getUTCMonth() + 1);
  const day = pad(istDate.getUTCDate());
  const hours24 = istDate.getUTCHours();
  const hours = pad(hours24);
  const minutes = pad(istDate.getUTCMinutes());
  const seconds = pad(istDate.getUTCSeconds());

  const hour12 = hours24 % 12 || 12;
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const time12 = `${pad(hour12)}:${minutes}:${seconds} ${ampm}`;
  const shortTime12 = `${pad(hour12)}:${minutes} ${ampm}`;
  const time24 = `${hours}:${minutes}:${seconds}`;
  const dateStr = `${year}-${month}-${day}`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedDate = `${day} ${months[istDate.getUTCMonth()]} ${year}`;
  const formattedDateTime = `${formattedDate}, ${shortTime12}`;

  return {
    date: dateStr,
    time: time12,
    shortTime: shortTime12,
    time24,
    formattedDate,
    formattedDateTime,
    dateTimeIST: `${dateStr} ${time24}`,
    isoIST: `${dateStr}T${time24}+05:30`,
  };
}

function serializeCustomer<T extends { latitude?: unknown; longitude?: unknown; createdAt?: unknown; updatedAt?: unknown }>(customer: T) {
  const ist = customer.createdAt ? formatISTDetails(customer.createdAt) : null;
  const updatedIst = customer.updatedAt ? formatISTDetails(customer.updatedAt) : null;

  return {
    ...customer,
    latitude: customer.latitude != null ? Number(customer.latitude) : null,
    longitude: customer.longitude != null ? Number(customer.longitude) : null,
    // Live Indian Time (IST) formatting
    createdDate: ist?.date ?? null,
    createdTime: ist?.time ?? null,
    createdDateTime: ist?.formattedDateTime ?? null,
    createdAtIST: ist?.isoIST ?? null,
    istDate: ist?.date ?? null,
    istTime: ist?.time ?? null,
    updatedAtIST: updatedIst?.isoIST ?? null,
  };
}

export function createCustomerService(database: PrismaClient) {
  return {
    create: async (user: UserContext, input: CreateCustomerInput) => {
      // 1. Parallel validation: Category, duplicate phone check, and optional seller check
      const [category, existingCustomer, seller] = await Promise.all([
        database.category.findUnique({ where: { id: input.categoryId } }),
        database.customer.findFirst({
          where: { phone: input.phone },
          select: { id: true, shopName: true, phone: true },
        }),
        input.sellerId ? database.user.findUnique({ where: { id: input.sellerId } }) : null,
      ]);

      if (!category || !category.active) {
        throw new HttpError(400, "Invalid or inactive category ID");
      }

      if (existingCustomer) {
        throw new HttpError(409, `A shopkeeper with this phone number (${input.phone}) already exists: ${existingCustomer.shopName}`);
      }

      // 2. Determine sellerId based on user role
      let assignedSellerId: string;
      if (user.role === "SELLER" || (user.role === "MANAGER" && user.isSeller && (!input.sellerId || input.sellerId === user.id))) {
        assignedSellerId = user.id;
      } else if (input.sellerId) {
        // Verify seller exists and is active
        if (!seller || (seller.role !== "SELLER" && !seller.isSeller) || !seller.active) {
          throw new HttpError(400, "Invalid or inactive seller ID");
        }
        // If Manager, ensure seller is assigned to this Manager (or is the manager)
        if (user.role === "MANAGER" && seller.managerId !== user.id && seller.id !== user.id) {
          throw new HttpError(403, "Seller is not assigned to you");
        }
        assignedSellerId = input.sellerId;
      } else if (user.role === "MANAGER") {
        assignedSellerId = user.id;
      } else {
        throw new HttpError(400, "sellerId is required when onboarding customer as Admin");
      }

      let customCreatedAt: Date | undefined;
      if (input.createdAt) {
        const parsed = new Date(input.createdAt);
        if (!Number.isNaN(parsed.getTime())) {
          customCreatedAt = parsed;
        }
      } else if (input.date) {
        let hours = 0;
        let minutes = 0;
        let seconds = 0;
        if (input.time) {
          const timeMatch = input.time.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (timeMatch) {
            hours = parseInt(timeMatch[1] ?? "0", 10);
            minutes = parseInt(timeMatch[2] ?? "0", 10);
            seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
            const ampm = timeMatch[4]?.toLowerCase();
            if (ampm === "pm" && hours < 12) hours += 12;
            if (ampm === "am" && hours === 12) hours = 0;
          }
        }
        const parts = input.date.split("-").map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          customCreatedAt = istToUtcDate(parts[0], parts[1] - 1, parts[2], hours, minutes, seconds);
        }
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

      if (customCreatedAt) {
        data["createdAt"] = customCreatedAt;
      }

      if (input.email !== undefined) data["email"] = input.email;
      if (input.photoPath !== undefined) data["photoPath"] = input.photoPath;
      if (input.noPhotoReason !== undefined) data["noPhotoReason"] = input.noPhotoReason;

      let finalLat = input.latitude;
      let finalLng = input.longitude;

      const needsGeocodeFallback =
        (finalLat === undefined && finalLng === undefined) ||
        isGpsAccuracyPoor(input.accuracy);

      const hasApiKey = Boolean(process.env["GOOGLE_MAPS_API_KEY"] || process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]);
      if (needsGeocodeFallback && hasApiKey) {
        const addressQuery = buildAddressQuery({
          shopNumber: input.shopNumber,
          streetName: input.streetName,
          village: input.village,
          district: input.district,
          state: input.state,
          pincode: input.pincode,
        });
        if (addressQuery.length >= 3) {
          try {
            const geocoded = await forwardGeocode(addressQuery);
            if (geocoded) {
              finalLat = geocoded.latitude;
              finalLng = geocoded.longitude;
            }
          } catch {
            // Geocoding is best-effort; proceed without coordinates
          }
        }
      }

      if (finalLat !== undefined) data["latitude"] = new Prisma.Decimal(finalLat);
      if (finalLng !== undefined) data["longitude"] = new Prisma.Decimal(finalLng);

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

      return serializeCustomer({
        ...customer,
        shopNumber: input.shopNumber,
        streetName: input.streetName,
        pincode: input.pincode,
        address: fullAddress || `${customer.village}, ${customer.district}, ${customer.state}`,
      });
    },

    createBulk: async (user: UserContext, input: CreateBulkCustomersInput) => {
      if (!input.customers || input.customers.length === 0) {
        throw new HttpError(400, "At least one customer is required");
      }

      // 1. Check duplicate phones within the batch itself
      const phones = input.customers.map((c) => c.phone);
      const duplicates = phones.filter((p, idx) => phones.indexOf(p) !== idx);
      if (duplicates.length > 0) {
        const dupList = Array.from(new Set(duplicates)).join(", ");
        throw new HttpError(400, `Duplicate phone numbers found within this batch: ${dupList}`);
      }

      // 2. Check if any phone already exists in DB
      const existingCustomers = await database.customer.findMany({
        where: { phone: { in: phones } },
        select: { phone: true, shopName: true },
      });
      if (existingCustomers.length > 0) {
        const conflictMsg = existingCustomers
          .map((c) => `"${c.shopName}" (${c.phone})`)
          .join(", ");
        throw new HttpError(409, `The following phone numbers are already registered in the database: ${conflictMsg}`);
      }

      // 3. Resolve seller ID
      let defaultAssignedSellerId: string;
      if (user.role === "SELLER" || (user.role === "MANAGER" && user.isSeller && (!input.defaultSellerId || input.defaultSellerId === user.id))) {
        defaultAssignedSellerId = user.id;
      } else if (input.defaultSellerId) {
        const seller = await database.user.findUnique({ where: { id: input.defaultSellerId } });
        if (!seller || (seller.role !== "SELLER" && !seller.isSeller) || !seller.active) {
          throw new HttpError(400, "Invalid or inactive default seller ID");
        }
        if (user.role === "MANAGER" && seller.managerId !== user.id && seller.id !== user.id) {
          throw new HttpError(403, "Seller is not assigned to you");
        }
        defaultAssignedSellerId = input.defaultSellerId;
      } else if (user.role === "MANAGER") {
        defaultAssignedSellerId = user.id;
      } else {
        if (!input.defaultSellerId && input.customers.some((c) => !c.sellerId)) {
          throw new HttpError(400, "defaultSellerId is required for Super Admin bulk onboarding when rows lack sellerId");
        }
        defaultAssignedSellerId = input.defaultSellerId || user.id;
      }

      // 4. Resolve Category IDs
      const allCategoryIds = Array.from(
        new Set(
          input.customers
            .map((c) => c.categoryId || input.defaultCategoryId)
            .filter((id): id is string => Boolean(id))
        )
      );

      if (allCategoryIds.length === 0) {
        throw new HttpError(400, "Category is required. Provide defaultCategoryId or categoryId on each customer.");
      }

      const validCategories = await database.category.findMany({
        where: { id: { in: allCategoryIds }, active: true },
        select: { id: true, name: true },
      });
      const validCategoryMap = new Map(validCategories.map((c) => [c.id, c.name]));
      for (const catId of allCategoryIds) {
        if (!validCategoryMap.has(catId)) {
          throw new HttpError(400, `Invalid or inactive category ID: ${catId}`);
        }
      }

      // 5. Build records for database creation
      const now = new Date();
      const recordsToCreate = input.customers.map((c, idx) => {
        const catId = c.categoryId || input.defaultCategoryId;
        if (!catId) {
          throw new HttpError(400, `Row ${idx + 1} (${c.shopName}): Category is required`);
        }

        const state = c.state || input.defaultState || user.state || "Maharashtra";
        const district = c.district || input.defaultDistrict || user.district || "";
        const village = c.village || input.defaultVillage || user.village || "";
        if (!district || !village) {
          throw new HttpError(400, `Row ${idx + 1} (${c.shopName}): District and Village/Town are required`);
        }

        const sellerId = c.sellerId || defaultAssignedSellerId;
        const computedAddress =
          c.address ||
          [c.shopNumber, c.streetName, village, district, state, c.pincode].filter(Boolean).join(", ") ||
          `${village}, ${district}, ${state}`;

        const data: Record<string, unknown> = {
          shopName: c.shopName,
          contactName: c.contactName,
          phone: c.phone,
          categoryId: catId,
          sellerId: sellerId,
          createdById: user.id,
          shopNumber: c.shopNumber || null,
          streetName: c.streetName || null,
          pincode: c.pincode || null,
          address: computedAddress,
          state: state,
          district: district,
          village: village,
          noPhotoReason: c.noPhotoReason || input.defaultNoPhotoReason || "Bulk onboarding batch",
          createdAt: c.createdAt ? new Date(c.createdAt) : now,
        };

        if (c.email) data["email"] = c.email;
        if (c.photoPath) data["photoPath"] = c.photoPath;
        if (c.latitude !== undefined && c.latitude !== null && !isNaN(Number(c.latitude))) {
          data["latitude"] = new Prisma.Decimal(Number(c.latitude));
        }
        if (c.longitude !== undefined && c.longitude !== null && !isNaN(Number(c.longitude))) {
          data["longitude"] = new Prisma.Decimal(Number(c.longitude));
        }

        return data as Prisma.CustomerCreateInput;
      });

      // 6. Execute atomic batch creation in a single transaction
      const createdCustomers = await database.$transaction(
        recordsToCreate.map((data) =>
          database.customer.create({
            data,
            include: {
              category: { select: { id: true, name: true } },
              seller: { select: { id: true, name: true, phone: true } },
            },
          })
        )
      );

      return {
        count: createdCustomers.length,
        customers: createdCustomers.map((c) => serializeCustomer(c)),
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
        const managerWhere: Prisma.CustomerWhereInput = { OR: [{ seller: { managerId: user.id } }, { sellerId: user.id }] };

        if (query.sellerId) {
          where.AND = [managerWhere, { sellerId: query.sellerId }];
        } else {
          where.AND = [managerWhere];
        }
      } else if (query.sellerId) {
        where.sellerId = query.sellerId;
      }

      const [total, items] = await Promise.all([
        database.customer.count({ where }),
        database.customer.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          include: {
            category: { select: { id: true, name: true } },
            seller: { select: { id: true, name: true, phone: true } },
          },
        }),
      ]);
      const totalPages = Math.ceil(total / query.pageSize);

      return {
        items: items.map(serializeCustomer),
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
        if (customer.sellerId !== user.id && customer.seller.managerId !== user.id) {
          throw new HttpError(404, "Customer not found or outside assigned scope");
        }
      }

      return serializeCustomer(customer);
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
      if (user.role === "MANAGER" && existing.sellerId !== user.id && existing.seller.managerId !== user.id) {
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
      if (input.noPhotoReason !== undefined) updateData["noPhotoReason"] = input.noPhotoReason;
      if (input.active !== undefined) updateData["active"] = input.active;

      let finalLat = input.latitude;
      let finalLng = input.longitude;

      if (isGpsAccuracyPoor(input.accuracy) && (finalLat !== undefined || finalLng !== undefined)) {
        const addressQuery = buildAddressQuery({
          shopNumber: input.shopNumber ?? existing.shopNumber ?? undefined,
          streetName: input.streetName ?? existing.streetName ?? undefined,
          village: input.village ?? existing.village ?? undefined,
          district: input.district ?? existing.district ?? undefined,
          state: input.state ?? existing.state ?? undefined,
          pincode: input.pincode ?? existing.pincode ?? undefined,
        });
        if (addressQuery.length >= 3) {
          try {
            const geocoded = await forwardGeocode(addressQuery);
            if (geocoded) {
              finalLat = geocoded.latitude;
              finalLng = geocoded.longitude;
            }
          } catch {
            // best-effort
          }
        }
      }

      if (finalLat !== undefined) updateData["latitude"] = new Prisma.Decimal(finalLat);
      if (finalLng !== undefined) updateData["longitude"] = new Prisma.Decimal(finalLng);

      const updated = await database.customer.update({
        where: { id },
        data: updateData as Prisma.CustomerUpdateInput,
        include: {
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true, phone: true } },
        },
      });
      return serializeCustomer(updated);
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
      if (user.role === "MANAGER" && existing.sellerId !== user.id && existing.seller.managerId !== user.id) {
        throw new HttpError(403, "Customer is not under your assigned sellers");
      }

      const uploadResult = await uploadCustomerPhoto(id, file.buffer, file.mimetype, existing.photoPath);

      const customer = await database.customer.update({
        where: { id },
        data: { photoPath: uploadResult.publicUrl, noPhotoReason: null },
        include: {
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true, phone: true } },
        },
      });

      return { customer: serializeCustomer(customer), photoUrl: uploadResult.publicUrl };
    },
  };
}

export type CustomerService = ReturnType<typeof createCustomerService>;
