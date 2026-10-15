import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Femmeflo Inventory & Management API",
      version: "1.0.0",
      description: "Complete REST API documentation for Seller, Manager & Super Admin Management System",
    },
    servers: [
      {
        url: "/api/v1",
        description: "API v1 Endpoint Base",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: {
      "/auth/login": {
        post: {
          summary: "User Login",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    login: { type: "string", example: "admin@femmeflo.in" },
                    password: { type: "string", example: "Admin@123456" },
                  },
                  required: ["login", "password"],
                },
              },
            },
          },
          responses: {
            200: { description: "Login successful" },
            401: { description: "Invalid credentials" },
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          summary: "Request Password Reset Token",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { login: { type: "string", example: "seller@femmeflo.com" } },
                  required: ["login"],
                },
              },
            },
          },
          responses: { 200: { description: "Generic success response" } },
        },
      },
      "/auth/reset-password": {
        post: {
          summary: "Reset Password With Token",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    newPassword: { type: "string" },
                  },
                  required: ["token", "newPassword"],
                },
              },
            },
          },
          responses: { 200: { description: "Password reset successful" } },
        },
      },
      "/seller/profile": {
        get: {
          summary: "Get Authenticated Seller Profile",
          tags: ["Seller"],
          responses: { 200: { description: "Seller profile details" } },
        },
        patch: {
          summary: "Update Seller Profile",
          tags: ["Seller"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" } },
                },
              },
            },
          },
          responses: { 200: { description: "Profile updated" } },
        },
      },
      "/admin/reports/sales": {
        get: {
          summary: "Get Sales Reports (JSON / CSV / Excel)",
          tags: ["Reports"],
          parameters: [
            { name: "from", in: "query", schema: { type: "string" } },
            { name: "to", in: "query", schema: { type: "string" } },
            { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv", "xlsx"] } },
            { name: "groupBy", in: "query", schema: { type: "string", enum: ["date", "seller", "manager", "state", "district", "village"] } },
          ],
          responses: { 200: { description: "Sales Report Data" } },
        },
      },
      "/admin/reports/inventory": {
        get: {
          summary: "Get Inventory Reports (JSON / CSV / Excel)",
          tags: ["Reports"],
          parameters: [
            { name: "from", in: "query", schema: { type: "string" } },
            { name: "to", in: "query", schema: { type: "string" } },
            { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv", "xlsx"] } },
          ],
          responses: { 200: { description: "Inventory Report Data" } },
        },
      },
      "/admin/permissions": {
        get: {
          summary: "List Application Permissions",
          tags: ["Permissions"],
          responses: { 200: { description: "Permissions list" } },
        },
      },
      "/admin/permissions/managers/{id}/permissions": {
        patch: {
          summary: "Update Manager Permissions",
          tags: ["Permissions"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { permissions: { type: "array", items: { type: "string" } } },
                },
              },
            },
          },
          responses: { 200: { description: "Updated permissions" } },
        },
      },

      "/seller/customers/{id}/photo": {
        post: {
          summary: "Upload Customer Storefront Photo",
          tags: ["Customers"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    photo: {
                      type: "string",
                      format: "binary",
                      description: "Image file (JPEG, PNG, WebP up to 5MB)",
                    },
                  },
                  required: ["photo"],
                },
              },
            },
          },
          responses: {
            200: { description: "Photo uploaded and customer updated successfully" },
            400: { description: "Invalid coordinate or photo file missing" },
            403: { description: "Forbidden or customer outside assigned scope" },
            413: { description: "Photo file exceeds maximum size limit" },
            415: { description: "Unsupported photo MIME type" },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  const sendDoc = (_req: any, res: any) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  };
  app.get("/api/v1/docs.json", sendDoc);
  app.get("/docs.json", sendDoc);
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
