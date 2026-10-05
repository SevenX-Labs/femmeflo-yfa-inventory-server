import type { PrismaClient } from "../../generated/prisma/client.js";
import { createManager, getUser, listUsers, updateUser } from "../user.service.js";
import type { CreateManagerInput, ListUsersInput, UpdateUserInput } from "../../controller/user.validation.js";

export function createManagerService(database: PrismaClient) {
  return {
    create: (input: CreateManagerInput) => createManager(database, input),
    list: (query: ListUsersInput) => listUsers(database, { role: "MANAGER" }, query),
    get: (id: string) => getUser(database, { role: "MANAGER" }, id),
    update: (id: string, input: UpdateUserInput) => updateUser(database, "MANAGER", id, input),
  };
}
