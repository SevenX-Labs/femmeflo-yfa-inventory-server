import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "./validation.js";
import { Prisma } from "../generated/prisma/client.js";

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ success: false, message: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  // 1. Explicit HttpError (validation, business authorization, custom HTTP errors)
  if (error instanceof HttpError) {
    response.status(error.status).json({ success: false, message: error.message });
    return;
  }

  // 2. Multer upload errors
  if (error && typeof error === "object" && "name" in error && error.name === "MulterError") {
    const multerError = error as unknown as { code: string; message: string };
    if (multerError.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({ success: false, message: "Uploaded file exceeds maximum allowed size" });
      return;
    }
    if (multerError.code === "LIMIT_UNEXPECTED_FILE") {
      response.status(400).json({ success: false, message: "Unexpected file field in upload request" });
      return;
    }
    response.status(400).json({ success: false, message: multerError.message || "File upload validation error" });
    return;
  }

  // 3. Prisma Known Request Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) || [];
      const targetStr = Array.isArray(target) ? target.join(", ") : String(target);
      if (targetStr.includes("employeeCode")) {
        response.status(409).json({ success: false, message: "An employee with this Employee Code already exists" });
        return;
      }
      if (targetStr.includes("phone")) {
        response.status(409).json({ success: false, message: "An employee with this phone number already exists" });
        return;
      }
      if (targetStr.includes("email")) {
        response.status(409).json({ success: false, message: "An employee with this email address already exists" });
        return;
      }
      response.status(409).json({ success: false, message: "A record with those unique details already exists" });
      return;
    }
    const errors: Record<string, [number, string]> = {
      P2003: [409, "Related record does not exist or is still in use"],
      P2025: [404, "Resource not found"],
      P2028: [409, "Transaction timed out or already completed. Please retry"],
      P2034: [409, "Concurrent update. Please retry"],
    };
    const mapped = errors[error.code];
    if (mapped) {
      response.status(mapped[0]).json({ success: false, message: mapped[1] });
      return;
    }
  }

  // 4. Express body-parser error types
  const type = typeof error === "object" && error !== null && "type" in error ? (error as { type: string }).type : undefined;
  if (type === "entity.parse.failed") {
    response.status(400).json({ success: false, message: "Request body must be valid JSON" });
    return;
  }
  if (type === "entity.too.large") {
    response.status(413).json({ success: false, message: "Request body is too large" });
    return;
  }
  if (type === "charset.unsupported" || type === "encoding.unsupported") {
    response.status(415).json({ success: false, message: "Unsupported request encoding" });
    return;
  }

  // 5. Unhandled / unexpected errors: keep dev logs useful, keep production safe
  if (process.env.NODE_ENV !== "production") {
    console.error("An unexpected request error occurred:", error);
  } else {
    console.error("An unexpected request error occurred");
  }

  response.status(500).json({ success: false, message: "Internal server error" });
};
