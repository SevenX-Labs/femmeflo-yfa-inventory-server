import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import type { Router } from "express";
import { errorHandler, notFound } from "./middleware/error.middleware.js";

type AppOptions = {
  corsOrigins: string[];
  requestLogging?: boolean;
  authRoutes?: Router | undefined;
  userRoutes?: Router | undefined;
  checkDatabase?: (() => Promise<void>) | undefined;
};

export function createApp({ corsOrigins, requestLogging = true, authRoutes, userRoutes, checkDatabase }: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  if (requestLogging) {
    // Avoid logging URLs/query strings that could contain password-reset tokens.
    app.use(morgan(":method :status :response-time ms"));
  }
  app.use(express.json({ limit: "100kb" }));
  app.get("/api/v1/health", (_request, response) => {
    response.json({
      success: true,
      message: "API is running",
      data: { status: "ok", database: checkDatabase ? "configured" : "not_configured" },
    });
  });
  app.get("/api/v1/ready", async (_request, response) => {
    if (!checkDatabase) {
      response.status(503).json({ success: false, message: "Database is not configured" });
      return;
    }
    try {
      await checkDatabase();
      response.json({ success: true, message: "API is ready", data: { database: "connected" } });
    } catch {
      response.status(503).json({ success: false, message: "Database is unavailable" });
    }
  });
  if (authRoutes) app.use("/api/v1/auth", authRoutes);
  else app.use("/api/v1/auth", (_request, response) => {
    response.status(503).json({ success: false, message: "Authentication service is not configured" });
  });
  if (userRoutes) app.use("/api/v1", userRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
