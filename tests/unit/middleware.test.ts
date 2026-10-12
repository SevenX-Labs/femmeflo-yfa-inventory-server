import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { authenticate } from "../../src/middleware/auth.middleware.js";
import { authorize, requireRole } from "../../src/middleware/rbac.middleware.js";
import { errorHandler, notFound } from "../../src/middleware/error.middleware.js";
import { parseInput, HttpError } from "../../src/middleware/validation.js";
import { z } from "zod";

test("Centralized Middleware & Error Handling Unit Tests", async (t) => {
  const dummyAuth = {
    async authenticate(token: string) {
      if (token === "valid-admin-token") {
        return { id: "u-1", name: "Admin User", role: "SUPER_ADMIN", permissions: [], active: true };
      }
      if (token === "valid-seller-token") {
        return { id: "u-2", name: "Seller User", role: "SELLER", permissions: [], active: true };
      }
      return null;
    },
  } as any;

  const app = express();
  app.use(express.json());

  app.get("/test/protected", authenticate(dummyAuth), (_req, res) => {
    res.json({ success: true, message: "Protected resource accessed" });
  });

  app.get("/test/admin-only", authenticate(dummyAuth), authorize("Admin"), (_req, res) => {
    res.json({ success: true, message: "Admin area accessed" });
  });

  app.get("/test/error", (_req, _res) => {
    throw new HttpError(403, "Custom forbidden message");
  });

  app.get("/test/unexpected", (_req, _res) => {
    throw new Error("Secret database stack trace or credential error");
  });

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  await t.test("Rejects request with missing authentication header with 401", async () => {
    const res = await fetch(`${baseUrl}/test/protected`);
    assert.equal(res.status, 401);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Authentication required/);
  });

  await t.test("Rejects invalid token with 401", async () => {
    const res = await fetch(`${baseUrl}/test/protected`, {
      headers: { Authorization: "Bearer bad-token" },
    });
    assert.equal(res.status, 401);
  });

  await t.test("Permits authenticated request with valid token", async () => {
    const res = await fetch(`${baseUrl}/test/protected`, {
      headers: { Authorization: "Bearer valid-admin-token" },
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
  });

  await t.test("Rejects insufficient role with 403 using authorize('Admin')", async () => {
    const res = await fetch(`${baseUrl}/test/admin-only`, {
      headers: { Authorization: "Bearer valid-seller-token" },
    });
    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Access denied/);
  });

  await t.test("Permits authorized role with authorize('Admin') mapping to SUPER_ADMIN", async () => {
    const res = await fetch(`${baseUrl}/test/admin-only`, {
      headers: { Authorization: "Bearer valid-admin-token" },
    });
    assert.equal(res.status, 200);
  });

  await t.test("Returns 404 for unknown route", async () => {
    const res = await fetch(`${baseUrl}/non-existent-route`);
    assert.equal(res.status, 404);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Route not found/);
  });

  await t.test("Custom HttpError returns appropriate status and message", async () => {
    const res = await fetch(`${baseUrl}/test/error`);
    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.message, "Custom forbidden message");
  });

  await t.test("Unexpected internal server error returns safe generic 500 without leaking stack trace or secrets", async () => {
    const res = await fetch(`${baseUrl}/test/unexpected`);
    assert.equal(res.status, 500);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Internal server error");
    assert.equal(body.stack, undefined);
    assert.equal(body.error, undefined);
  });
});
