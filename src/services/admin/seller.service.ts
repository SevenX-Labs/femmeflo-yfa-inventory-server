import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSeller, getUser, listUsers, updateUser } from "../user.service.js";
import type { CreateSellerInput, ListUsersInput, UpdateUserInput } from "../../controller/user.validation.js";

export function createAdminSellerService(database: PrismaClient) {
  const sellerScope = { OR: [{ role: "SELLER" as const }, { isSeller: true }] };
  return {
    create: (input: CreateSellerInput) => createSeller(database, input),
    list: (query: ListUsersInput) => listUsers(database, sellerScope, query),
    get: (id: string) => getUser(database, sellerScope, id),
    update: (id: string, input: UpdateUserInput) => updateUser(database, sellerScope, id, input),
  };
}
