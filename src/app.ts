import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import type { Router } from "express";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import { setupSwagger } from "./config/swagger.js";
import { globalApiRateLimiter } from "./middleware/rate-limit.middleware.js";
import { networkPerformanceLogger } from "./middleware/performance.middleware.js";

type AppOptions = {
  corsOrigins: string[];
  requestLogging?: boolean;
  authRoutes?: Router | undefined;
  adminAuthRoutes?: Router | undefined;
  managerAuthRoutes?: Router | undefined;
  sellerAuthRoutes?: Router | undefined;
  userRoutes?: Router | undefined;
  checkDatabase?: (() => Promise<void>) | undefined;
};

export function createApp({
  corsOrigins,
  requestLogging = true,
  authRoutes,
  adminAuthRoutes,
  managerAuthRoutes,
  sellerAuthRoutes,
  userRoutes,
  checkDatabase,
}: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());

  // Standard mobile app origins (Capacitor, Ionic, React Native Metro, Expo)
  const defaultMobileOrigins = [
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    "https://localhost",
    "http://localhost:8081",
    "http://localhost:19006",
  ];

  const allowedOriginsSet = new Set([...corsOrigins, ...defaultMobileOrigins]);
  const isWildcard = corsOrigins.includes("*");

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (native mobile apps, curl, Postman, server-to-server) or "null" origin
        if (!origin || origin === "null") {
          return callback(null, true);
        }
        // Allow wildcard or explicit allowed origins
        if (isWildcard || allowedOriginsSet.has(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Range",
        "x-no-compression",
      ],
      exposedHeaders: [
        "Content-Length",
        "Content-Range",
        "Content-Disposition",
        "Server-Timing",
      ],
      maxAge: 86400,
    })
  );

  // Compression: compress JSON/responses >= 1KB, skip already-compressed or SSE
  app.use(
    compression({
      threshold: 1024,
      level: 6,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        const contentType = res.getHeader("Content-Type") as string | undefined;
        if (contentType && contentType.includes("text/event-stream")) return false;
        return compression.filter(req, res);
      },
    })
  );

  // Performance telemetry & timing
  app.use(networkPerformanceLogger);

  if (requestLogging) {
    // Avoid logging URLs/query strings that could contain password-reset tokens.
    app.use(morgan(":method :status :response-time ms"));
  }
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/v1", globalApiRateLimiter);
  setupSwagger(app);
  app.get("/", (_request, response) => {
    response.json({
      success: true,
      message: "Server is ready",
      data: {
        status: "ok",
        database: checkDatabase ? "configured" : "not_configured",
      },
    });
  });

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
  if (adminAuthRoutes) {
    app.use("/api/v1/admin/auth", adminAuthRoutes);
  }
  if (managerAuthRoutes) {
    app.use("/api/v1/manager/auth", managerAuthRoutes);
    app.use("/api/v1/manger/auth", managerAuthRoutes);
  }
  if (sellerAuthRoutes) {
    app.use("/api/v1/seller/auth", sellerAuthRoutes);
  }
  if (userRoutes) app.use("/api/v1", userRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

