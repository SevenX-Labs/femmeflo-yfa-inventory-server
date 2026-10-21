import type { Request, Response } from "express";
import type { AdminInventoryService } from "../../services/admin/inventory.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, HttpError } from "../../middleware/validation.js";
import { createWarehouseSchema, createReceiptSchema, createTransferSchema, listTransactionsSchema, updateLocationBalanceSchema } from "../inventory.validation.js";

export function createAdminInventoryController(service: AdminInventoryService) {
  return {
    getSummary: async (_request: Request, response: Response) => {
      const summary = await service.getSummary();
      const warehouses = summary.locations.filter((l) => l.type === "WAREHOUSE" || l.type === "HQ");
      const sellers = summary.locations.filter((l) => l.type === "SELLER");
      response.json({
        success: true,
        message: "Inventory summary retrieved",
        data: {
          ...summary,
          totalInventory: summary.totalStock,
          warehouses: summary.locations,
          sellers,
        },
      });
    },

    createWarehouse: async (request: Request, response: Response) => {
      const input = parseInput(createWarehouseSchema, request.body);
      const warehouse = await service.createWarehouse(input);
      response.status(201).json({
        success: true,
        message: "Warehouse created",
        data: { warehouse },
      });
    },

    listWarehouses: async (_request: Request, response: Response) => {
      const warehouses = await service.listWarehouses();
      response.json({
        success: true,
        message: "Warehouses retrieved",
        data: { items: warehouses, warehouses },
      });
    },

    deleteWarehouse: async (request: Request, response: Response) => {
      const id = String(request.params.id);
      if (!id) {
        throw new HttpError(400, "Warehouse ID is required");
      }
      await service.deleteWarehouse(id);
      response.json({
        success: true,
        message: "Warehouse deleted successfully",
      });
    },

    addReceipt: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(createReceiptSchema, request.body);
      const result = await service.addReceipt(user.id, input);
      response.status(201).json({
        success: true,
        message: "Stock receipt added to HQ",
        data: result,
      });
    },

    transfer: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(createTransferSchema, request.body);
      const result = await service.transfer(user.id, input);
      response.status(200).json({
        success: true,
        message: "Stock transfer completed",
        data: result,
      });
    },

    updateLocationBalance: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const id = String(request.params.id);
      const input = parseInput(updateLocationBalanceSchema, request.body);
      const result = await service.updateLocationBalance(user.id, id, input);
      response.status(200).json({
        success: true,
        message: "Stock balance updated successfully",
        data: result,
      });
    },

    listTransactions: async (request: Request, response: Response) => {
      const query = parseInput(listTransactionsSchema, request.query);
      const result = await service.listTransactions(query);
      response.json({
        success: true,
        message: "Stock transactions retrieved",
        data: { ...result, transactions: result.items },
      });
    },
  };
}
