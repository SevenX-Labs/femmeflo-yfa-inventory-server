import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { realtimeHub } from "../src/services/realtime/realtime.service.js";

describe("RealtimeEventHub Role-Based Delivery & Publishing", () => {
  it("delivers targeted seller events to Admin, Manager, and owning Seller, but hides them from unrelated Sellers", () => {
    const before = Date.now() - 1;

    const evt = realtimeHub.publish({
      type: "SALE_STATUS_UPDATE",
      actorId: "admin_1",
      role: "SUPER_ADMIN",
      entityId: "sale_100",
      action: "APPROVE",
      targetUserIds: ["seller_A", "admin_1"],
      targetRoles: ["SUPER_ADMIN", "MANAGER"],
      data: { saleId: "sale_100", sellerId: "seller_A", status: "CONFIRMED" },
    });

    assert.ok(evt.id.startsWith("evt_"));
    assert.equal(evt.type, "SALE_STATUS_UPDATE");

    const adminEvents = realtimeHub.getEventsSince(before, ["SALE_STATUS_UPDATE"], {
      id: "admin_1",
      role: "SUPER_ADMIN",
    });
    assert.ok(adminEvents.some((e) => e.id === evt.id), "Admin should receive event");

    const managerEvents = realtimeHub.getEventsSince(before, ["SALE_STATUS_UPDATE"], {
      id: "manager_1",
      role: "MANAGER",
    });
    assert.ok(managerEvents.some((e) => e.id === evt.id), "Manager should receive team event");

    const sellerAEvents = realtimeHub.getEventsSince(before, ["SALE_STATUS_UPDATE"], {
      id: "seller_A",
      role: "SELLER",
    });
    assert.ok(sellerAEvents.some((e) => e.id === evt.id), "Owning Seller A should receive event");

    const sellerBEvents = realtimeHub.getEventsSince(before, ["SALE_STATUS_UPDATE"], {
      id: "seller_B",
      role: "SELLER",
    });
    assert.equal(
      sellerBEvents.some((e) => e.id === evt.id),
      false,
      "Unrelated Seller B must NOT receive Seller A's private event"
    );
  });

  it("filters events by timestamp and event type", () => {
    const evt = realtimeHub.publish({
      type: "CUSTOMER_UPDATE",
      actorId: "admin_1",
      role: "SUPER_ADMIN",
      entityId: "cust_1",
      action: "CREATE",
      targetUserIds: ["seller_A", "admin_1"],
      targetRoles: ["SUPER_ADMIN", "MANAGER"],
    });

    const futureEvents = realtimeHub.getEventsSince(evt.timestamp + 1000, undefined, {
      id: "admin_1",
      role: "SUPER_ADMIN",
    });
    assert.equal(futureEvents.some((e) => e.id === evt.id), false);

    const wrongTypeEvents = realtimeHub.getEventsSince(evt.timestamp - 10, ["SHIFT_UPDATE"], {
      id: "admin_1",
      role: "SUPER_ADMIN",
    });
    assert.equal(wrongTypeEvents.some((e) => e.id === evt.id), false);
  });
});
