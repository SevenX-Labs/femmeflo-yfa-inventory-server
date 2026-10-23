import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createApp } from "../src/app.js";
import { createGeoRoutes } from "../src/routes/geo.routes.js";
import { createCategoryRoutes } from "../src/routes/category.routes.js";

test("Performance Middleware: Compression, Telemetry, and ETags", async (t) => {
  const mockDb: any = {
    category: {
      findMany: async () => [
        { id: "cat-1", name: "Feminine Hygiene", active: true },
        { id: "cat-2", name: "Personal Care", active: true },
      ],
      count: async () => 2,
    },
  };

  const testRouter = express.Router();
  testRouter.use("/categories", createCategoryRoutes(mockDb));
  testRouter.use("/geo", createGeoRoutes());
  testRouter.get("/test-heavy-json", (_req, res) => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `item-${i}`,
      name: `Product Batch Item #${i}`,
      description: "Repetitive description to demonstrate wire-level dictionary compression efficiency",
      pricePaise: 25000,
      active: true,
    }));
    res.json({ success: true, data: { items } });
  });

  const app = createApp({
    corsOrigins: ["*"],
    requestLogging: false,
    userRoutes: testRouter,
  });

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Verify Gzip compression and Server-Timing telemetry on heavy payload
    const uncompressedRes = await fetch(`${baseUrl}/api/v1/test-heavy-json`, {
      headers: { "x-no-compression": "true" },
    });
    const uncompressedText = await uncompressedRes.text();
    const uncompressedBytes = Buffer.byteLength(uncompressedText);
    assert.ok(uncompressedBytes > 2000, "Uncompressed payload should exceed 2 KB");
    assert.ok(uncompressedRes.headers.get("server-timing")?.includes("total;dur="), "Server-Timing header must be present");

    const rawGzipBytes = await new Promise<number>((resolve, reject) => {
      const httpReq = http.get(
        `${baseUrl}/api/v1/test-heavy-json`,
        { headers: { "Accept-Encoding": "gzip" } },
        (res) => {
          assert.equal(res.headers["content-encoding"], "gzip", "Response must be gzipped on wire");
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks).length));
        }
      );
      httpReq.on("error", reject);
    });
    assert.ok(rawGzipBytes < uncompressedBytes * 0.4, `Gzip size (${rawGzipBytes} bytes) should be < 40% of uncompressed (${uncompressedBytes} bytes)`);

    // 2. Verify ETag generation and HTTP 304 Not Modified conditional caching
    const catFirst = await fetch(`${baseUrl}/api/v1/categories`);
    assert.equal(catFirst.status, 200);
    const etag = catFirst.headers.get("etag");
    assert.ok(etag, "ETag must be returned on cacheable GET route");
    assert.ok(catFirst.headers.get("cache-control")?.includes("max-age=60"), "Cache-Control max-age must be set");

    // Second request with If-None-Match
    const catSecond = await fetch(`${baseUrl}/api/v1/categories`, {
      headers: { "If-None-Match": etag },
    });
    assert.equal(catSecond.status, 304, "Server must return HTTP 304 on matching ETag");
    assert.equal(catSecond.headers.get("content-length"), null, "304 response body must be empty");
  } finally {
    server.close();
  }
});
