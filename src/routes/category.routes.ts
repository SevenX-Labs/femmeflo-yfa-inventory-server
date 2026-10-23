import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { createCategoryController } from "../controller/category.controller.js";
import { createCategoryService } from "../services/category.service.js";
import { conditionalHttpCache } from "../middleware/http-cache.middleware.js";

export function createCategoryRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createCategoryController(createCategoryService(database));

  // Category reads are semi-static: cache for 60s, stale-while-revalidate 300s
  const cacheMiddleware = conditionalHttpCache({ maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });

  router.get("/", cacheMiddleware, controller.list);
  router.get("/:id", cacheMiddleware, controller.get);
  router.post("/", controller.create);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.delete);

  return router;
}
