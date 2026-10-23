import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { parseInput } from "../middleware/validation.js";
import { listProductsSchema } from "../controller/product.validation.js";
import { conditionalHttpCache } from "../middleware/http-cache.middleware.js";

type ProductItem = {
  id: string;
  name: string;
  sku: string | null;
  basePricePaise: number;
  minimumPricePaise: number;
};

let cachedProducts: ProductItem[] | null = null;
let productsCacheExpiresAt = 0;
const PRODUCTS_CACHE_TTL_MS = 30_000; // 30 seconds

export function invalidateProductsCache() {
  cachedProducts = null;
  productsCacheExpiresAt = 0;
}

export function createProductListRoutes(database: PrismaClient) {
  const router = Router();
  const productCache = conditionalHttpCache({ maxAgeSeconds: 30, staleWhileRevalidateSeconds: 120 });

  router.get("/", productCache, async (request, response) => {
    const query = parseInput(listProductsSchema, request.query);
    const now = Date.now();

    // Fast path: if no search query, return from memory cache
    if (!query.search && cachedProducts && productsCacheExpiresAt > now) {
      response.json({ success: true, data: { items: cachedProducts } });
      return;
    }

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

    if (!query.search) {
      cachedProducts = items;
      productsCacheExpiresAt = now + PRODUCTS_CACHE_TTL_MS;
    }

    response.json({ success: true, data: { items } });
  });

  return router;
}
