import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { createCategoryController } from "../controller/category.controller.js";
import { createCategoryService } from "../services/category.service.js";

export function createCategoryRoutes(database: PrismaClient) {
  const router = Router();
  const controller = createCategoryController(createCategoryService(database));

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.patch("/:id", controller.update);

  return router;
}
