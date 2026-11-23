import { EventEmitter } from "node:events";
import type { Request, Response } from "express";

export type RealtimeEventType =
  | "INVENTORY_UPDATE"
  | "SALE_STATUS_UPDATE"
  | "APPROVAL_UPDATE"
  | "SHIFT_UPDATE"
  | "CUSTOMER_UPDATE"
  | "HEARTBEAT";

export interface RealtimeEventPayload {
  id: string;
  type: RealtimeEventType;
  timestamp: number;
  actorId?: string;
  role?: string;
  entityId?: string;
  action?: string;
  data?: Record<string, unknown>;
}

class RealtimeEventHub {
  private emitter = new EventEmitter();
  private recentEvents: RealtimeEventPayload[] = [];
  private maxBufferedEvents = 100;
  private activeClientsCount = 0;

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  /**
   * Broadcast an event to all connected SSE clients and save in the recent buffer.
   */
  public broadcast(event: {
    type: RealtimeEventType;
    actorId?: string;
    role?: string;
    entityId?: string;
    action?: string;
    data?: Record<string, unknown>;
  }): RealtimeEventPayload {
    const payload: RealtimeEventPayload = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      ...event,
    };

    this.recentEvents.push(payload);
    if (this.recentEvents.length > this.maxBufferedEvents) {
      this.recentEvents.splice(0, this.recentEvents.length - this.maxBufferedEvents);
    }

    this.emitter.emit("event", payload);
    return payload;
  }

  /**
   * Register an Express SSE client stream.
   */
  public registerClient(
    req: Request,
    res: Response,
    user?: { id?: string; role?: string }
  ): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    this.activeClientsCount++;

    // Initial connected handshake
    const handshake = {
      status: "connected",
      userId: user?.id,
      role: user?.role,
      timestamp: Date.now(),
      activeClients: this.activeClientsCount,
    };
    res.write(`event: connected\ndata: ${JSON.stringify(handshake)}\n\n`);

    // Stream handler
    const listener = (payload: RealtimeEventPayload) => {
      try {
        res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Socket closed
      }
    };

    this.emitter.on("event", listener);

    // Heartbeat ping every 20 seconds to prevent reverse proxy timeouts
    const pingInterval = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(pingInterval);
      }
    }, 20_000);

    const cleanup = () => {
      clearInterval(pingInterval);
      this.emitter.off("event", listener);
      this.activeClientsCount = Math.max(0, this.activeClientsCount - 1);
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("finish", cleanup);
  }

  /**
   * Get events since a timestamp for polling fallback clients.
   */
  public getEventsSince(sinceTimestamp: number, types?: RealtimeEventType[]): RealtimeEventPayload[] {
    return this.recentEvents.filter((e) => {
      if (e.timestamp <= sinceTimestamp) return false;
      if (types && types.length > 0 && !types.includes(e.type)) return false;
      return true;
    });
  }

  public getStats() {
    return {
      activeClients: this.activeClientsCount,
      bufferedEvents: this.recentEvents.length,
      lastEventTimestamp: this.recentEvents[this.recentEvents.length - 1]?.timestamp ?? null,
    };
  }
}

export const realtimeHub = new RealtimeEventHub();
