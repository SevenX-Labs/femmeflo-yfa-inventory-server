import type { PrismaClient } from "../../generated/prisma/client.js";
import type { PublicUser } from "../auth/auth.types.js";
import type { CreateSellerInput, ListUsersInput } from "../../controller/user.validation.js";
import { assignedSellerScope, createSeller, getUser, listUsers } from "../user.service.js";

export function createManagerSellerService(database: PrismaClient) {
  return {
    create: (actor: PublicUser, input: Omit<CreateSellerInput, "managerId">) => createSeller(database, { ...input, managerId: actor.id }),
    list: (actor: PublicUser, query: ListUsersInput) => listUsers(database, assignedSellerScope(actor), query),
    get: (actor: PublicUser, id: string) => getUser(database, assignedSellerScope(actor), id),
  };
}
