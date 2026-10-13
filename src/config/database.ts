import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export function createDatabase(databaseUrl: string) {
  const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
  let connectionString = databaseUrl;
  if (!isLocal) {
    try {
      const url = new URL(connectionString);
      url.searchParams.delete("sslmode");
      connectionString = url.toString();
    } catch {
      // Keep original connectionString if URL cannot be parsed
    }
  }

  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 10,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  return new PrismaClient({ adapter });
}
