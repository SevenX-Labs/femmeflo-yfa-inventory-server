import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { parseInput } from "../middleware/validation.js";
import { listProductsSchema } from "../controller/product.validation.js";

export function createProductListRoutes(database: PrismaClient) {
  const router = Router();

  router.get("/", async (request, response) => {
    const query = parseInput(listProductsSchema, request.query);
    const where: Record<string, unknown> = { active: true };
    if (query.search) {
      where["OR"] = [
        { name: { contains: query.search, mode: "insensitive" } },
        { sku: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const items = await database.product.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, basePricePaise: true, minimumPricePaise: true },
    });
    response.json({ success: true, data: { items } });
  });

  return router;
}
