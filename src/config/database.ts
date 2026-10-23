import pg from "pg";
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

  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 300000, // 5 minutes (prevents premature connection drops)
    max: 20,
    min: isLocal ? 0 : 2, // Keep warm connections to eliminate 3.6s TLS/auth handshake penalty
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

  const adapter = new PrismaPg(pool, { disposeExternalPool: true });
  return new PrismaClient({ adapter });
}
