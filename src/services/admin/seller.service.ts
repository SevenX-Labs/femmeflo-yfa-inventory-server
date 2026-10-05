import type { PrismaClient } from "../../generated/prisma/client.js";
import { createSeller, getUser, listUsers, updateUser } from "../user.service.js";
import type { CreateSellerInput, ListUsersInput, UpdateUserInput } from "../../controller/user.validation.js";

export function createAdminSellerService(database: PrismaClient) {
  return {
    create: (input: CreateSellerInput) => createSeller(database, input),
    list: (query: ListUsersInput) => listUsers(database, { role: "SELLER" }, query),
    get: (id: string) => getUser(database, { role: "SELLER" }, id),
    update: (id: string, input: UpdateUserInput) => updateUser(database, "SELLER", id, input),
  };
}
