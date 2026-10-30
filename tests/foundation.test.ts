import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { createApp } from "../src/app.js";
import { loadEnvironment } from "../src/config/env.js";
import { errorHandler } from "../src/middleware/error.middleware.js";

let server: Server;
let baseUrl: string;

before(async () => {
  const app = createApp({ corsOrigins: ["http://localhost:3000"], requestLogging: false });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("health reports HTTP availability without claiming database connectivity", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: "API is running",
    data: { status: "ok", database: "not_configured" },
  });
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("unknown route returns a JSON 404", async () => {
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { success: false, message: "Route not found" });
});

test("readiness and auth return 503 when the database is not configured", async () => {
  assert.equal((await fetch(`${baseUrl}/api/v1/ready`)).status, 503);
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/me`)).status, 503);
});

test("readiness checks current connectivity instead of remembering startup state", async () => {
  let available = true;
  const app = createApp({ corsOrigins: [], requestLogging: false, checkDatabase: async () => {
    if (!available) throw new Error("private connection details");
  } });
  const readinessServer = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => readinessServer.once("listening", resolve));
  const url = `http://127.0.0.1:${(readinessServer.address() as AddressInfo).port}/api/v1/ready`;
  try {
    assert.equal((await fetch(url)).status, 200);
    available = false;
    const response = await fetch(url);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false, message: "Database is unavailable" });
  } finally {
    await new Promise<void>((resolve, reject) => readinessServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("malformed JSON returns 400 without echoing submitted data", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"password":secret',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, message: "Request body must be valid JSON" });
});

test("oversized JSON returns 413", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "x".repeat(110_000) }),
  });
  assert.equal(response.status, 413);
});

test("unsupported character encoding returns 415", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "POST", headers: { "Content-Type": "application/json; charset=iso-8859-1" }, body: "{}",
  });
  assert.equal(response.status, 415);
});

test("CORS permits configured frontend origins", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, { headers: { Origin: "http://localhost:3000" } });
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
});

test("CORS does not permit unlisted origins", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, { headers: { Origin: "https://unlisted.example" } });
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("CORS permits mobile application origins and handles preflight", async () => {
  for (const origin of ["capacitor://localhost", "ionic://localhost", "http://localhost"]) {
    const res = await fetch(`${baseUrl}/api/v1/health`, { headers: { Origin: origin } });
    assert.equal(res.headers.get("access-control-allow-origin"), origin);
  }

  const preflight = await fetch(`${baseUrl}/api/v1/health`, {
    method: "OPTIONS",
    headers: {
      Origin: "capacitor://localhost",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type, Authorization",
    },
  });
  assert.equal(preflight.headers.get("access-control-allow-origin"), "capacitor://localhost");
  assert.equal(preflight.status, 204);
});

test("configuration supplies development defaults", () => {
  assert.deepEqual(loadEnvironment({}), {
    NODE_ENV: "development",
    PORT: 5000,
    CORS_ORIGINS: ["http://localhost:3000"],
    SUPABASE_CUSTOMER_BUCKET: "customer-photos",
    MAX_PHOTO_SIZE_MB: 5,
    EMAIL_PROVIDER: "mock",
    EMAIL_FROM: "noreply@femmeflo.com",
    WHATSAPP_PROVIDER: "mock",
    NOTIFICATION_MAX_RETRIES: 3,
  });
});

test("configuration rejects invalid ports and origins", () => {
  for (const PORT of ["", "0", "-1", "65536", "5000.5", "abc"]) {
    assert.throws(() => loadEnvironment({ PORT }), /PORT/);
  }
  for (const CORS_ORIGINS of ["*", "", "https://example.com/path", "file:///tmp"]) {
    assert.throws(() => loadEnvironment({ CORS_ORIGINS }), /CORS_ORIGINS/);
  }
});

test("unexpected async errors use safe JSON 500 responses", async () => {
  const app = express();
  app.get("/failure", async () => { throw new Error("private database information"); });
  app.use(errorHandler);
  const errorServer = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => errorServer.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(errorServer.address() as AddressInfo).port}/failure`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { success: false, message: "Internal server error" });
  } finally {
    await new Promise<void>((resolve, reject) => errorServer.close((error) => error ? reject(error) : resolve()));
  }
});
