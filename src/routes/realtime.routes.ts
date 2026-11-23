import { Router } from "express";
import type { AuthService } from "../services/auth/auth.service.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";
import { realtimeHub, type RealtimeEventType } from "../services/realtime/realtime.service.js";

export function createRealtimeRoutes(auth: AuthService) {
  const router = Router();
  const authenticate = requireAuthentication(auth);

  /**
   * Real-time SSE Stream Endpoint
   * Clients connect with Bearer header or ?token=...
   */
  router.get("/stream", authenticate, (req, res) => {
    const user = res.locals.authUser as { id?: string; role?: string } | undefined;
    realtimeHub.registerClient(req, res, user);
  });

  /**
   * Real-time Polling Endpoint
   * Fallback for environments where SSE connections drop or long-lived connections are restricted
   */
  router.get("/poll", authenticate, (req, res) => {
    const since = Number(req.query["since"]) || 0;
    const typesParam = req.query["types"];
    let types: RealtimeEventType[] | undefined;

    if (typeof typesParam === "string") {
      types = typesParam.split(",") as RealtimeEventType[];
    }

    const events = realtimeHub.getEventsSince(since, types);
    res.json({
      success: true,
      data: {
        events,
        serverTime: Date.now(),
      },
    });
  });

  /**
   * Status / Diagnostic
   */
  router.get("/stats", authenticate, (_req, res) => {
    res.json({
      success: true,
      data: {
        ...realtimeHub.getStats(),
        serverTime: Date.now(),
      },
    });
  });

  return router;
}
