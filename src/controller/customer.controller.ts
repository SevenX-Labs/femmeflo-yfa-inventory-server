import type { Request, Response } from "express";
import type { CustomerService } from "../services/customer.service.js";
import type { PublicUser } from "../services/auth/auth.types.js";
import { parseInput, idSchema } from "../middleware/validation.js";
import { createCustomerSchema, listCustomersSchema, updateCustomerSchema } from "./customer.validation.js";

export function createCustomerController(service: CustomerService) {
  return {
    list: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const query = parseInput(listCustomersSchema, request.query);
      const result = await service.list(user, query);
      response.json({
        success: true,
        message: "Customers retrieved",
        data: result,
      });
    },

    create: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(createCustomerSchema, request.body);
      const customer = await service.create(user, input);
      response.status(201).json({
        success: true,
        message: "Customer created",
        data: { customer },
      });
    },

    get: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const customer = await service.get(user, id);
      response.json({
        success: true,
        message: "Customer retrieved",
        data: { customer },
      });
    },

    update: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      const input = parseInput(updateCustomerSchema, request.body);
      const customer = await service.update(user, id, input);
      response.json({
        success: true,
        message: "Customer updated",
        data: { customer },
      });
    },
  };
}
