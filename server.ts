import { createApp } from "./src/app.js";
import { createDatabase } from "./src/config/database.js";
import { loadAuthEnvironment, loadEnvironment } from "./src/config/env.js";
import { createAuthRoutes, createRoleAuthRoutes } from "./src/routes/auth/auth.routes.js";
import { createAuthService } from "./src/services/auth/auth.service.js";
import { createUserRoutes } from "./src/routes/user.routes.js";

const env = loadEnvironment();
const authEnv = loadAuthEnvironment();

async function start() {
  const database = authEnv ? createDatabase(authEnv.DATABASE_URL) : undefined;
  try {
    if (database) await database.$queryRaw`SELECT 1`;
    const auth = database && authEnv
      ? createAuthService(database, {
          secret: authEnv.JWT_SECRET, expiresIn: authEnv.JWT_EXPIRES_IN,
        })
      : undefined;
    const app = createApp({
      corsOrigins: env.CORS_ORIGINS,
      authRoutes: auth ? createAuthRoutes(auth) : undefined,
      adminAuthRoutes: auth ? createRoleAuthRoutes(auth, "SUPER_ADMIN") : undefined,
      managerAuthRoutes: auth ? createRoleAuthRoutes(auth, "MANAGER") : undefined,
      sellerAuthRoutes: auth ? createRoleAuthRoutes(auth, "SELLER") : undefined,
      userRoutes: auth && database ? createUserRoutes(database, auth) : undefined,
      checkDatabase: database ? async () => { await database.$queryRaw`SELECT 1`; } : undefined,
    });
    const server = app.listen(env.PORT, () => {
      console.info(`API listening on port ${env.PORT}`);
    });
    server.on("error", async () => {
      console.error("Server could not start. Check PORT and whether it is already in use.");
      process.exitCode = 1;
      await database?.$disconnect().catch(() => {});
    });
    function shutdown() {
      server.close(async (error) => {
        try {
          await database?.$disconnect();
          process.exitCode = error ? 1 : 0;
        } catch { process.exitCode = 1; }
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    }
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    await database?.$disconnect().catch(() => {});
    throw error;
  }
}

start().catch((error) => {
  console.error("Startup failed:", error);
  process.exitCode = 1;
});
