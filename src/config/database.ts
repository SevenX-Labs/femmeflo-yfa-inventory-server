import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export function createDatabase(databaseUrl: string) {
  const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 10,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  return new PrismaClient({ adapter });
}
