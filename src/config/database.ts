import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export function createDatabase(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, max: 5 });
  return new PrismaClient({ adapter });
}
