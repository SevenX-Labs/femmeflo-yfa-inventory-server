import { lookupPincode } from "../services/pincode.service.js";
import type { Request, Response } from "express";
import type { CustomerService } from "../services/customer.service.js";
import type { PublicUser } from "../services/auth/auth.types.js";
import { parseInput, idSchema, HttpError } from "../middleware/validation.js";
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
        data: { ...result, customers: result.items },
      });
    },

    create: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const input = parseInput(createCustomerSchema, request.body);
      const customer = await service.create(user, input);

      const files = request.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = request.file || files?.["photo"]?.[0] || files?.["image"]?.[0];
      if (file) {
        const photoResult = await service.uploadPhoto(user, customer.id, file);
        response.status(201).json({
          success: true,
          message: "Customer created with photo",
          data: {
            customer: photoResult.customer,
            photoUrl: photoResult.photoUrl,
            createdDate: photoResult.customer.createdDate,
            createdTime: photoResult.customer.createdTime,
            createdDateTime: photoResult.customer.createdDateTime,
            createdAtIST: photoResult.customer.createdAtIST,
          },
        });
        return;
      }

      response.status(201).json({
        success: true,
        message: "Customer created",
        data: {
          customer,
          createdDate: customer.createdDate,
          createdTime: customer.createdTime,
          createdDateTime: customer.createdDateTime,
          createdAtIST: customer.createdAtIST,
        },
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
      let customer = await service.update(user, id, input);

      const files = request.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = request.file || files?.["photo"]?.[0] || files?.["image"]?.[0];
      if (file) {
        const photoResult = await service.uploadPhoto(user, id, file);
        customer = photoResult.customer;
      }

      response.json({
        success: true,
        message: "Customer updated",
        data: { customer },
      });
    },

    lookupPincode: async (request: Request, response: Response) => {
      const rawPincode = request.params["pincode"] || request.query["pincode"];
      const pincode = Array.isArray(rawPincode) ? rawPincode[0] : rawPincode;
      if (!pincode || typeof pincode !== "string") {
        throw new HttpError(400, "Valid 6-digit PIN code is required");
      }
      const data = await lookupPincode(pincode);
      response.json({
        success: true,
        message: "Pincode details fetched",
        data,
      });
    },

    uploadPhoto: async (request: Request, response: Response) => {
      const user = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);

      const files = request.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = request.file || files?.["photo"]?.[0] || files?.["image"]?.[0];

      if (!file) {
        throw new HttpError(400, "Image file is required under field 'photo' or 'image'");
      }

      const result = await service.uploadPhoto(user, id, file);
      response.json({
        success: true,
        message: "Customer photo uploaded successfully",
        data: result,
      });
    },
  };
}
