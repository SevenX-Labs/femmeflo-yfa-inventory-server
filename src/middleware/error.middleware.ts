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
  const type = typeof error === "object" && error !== null && "type" in error
    ? error.type : undefined;
  if (error instanceof HttpError) {
    response.status(error.status).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const errors: Record<string, [number, string]> = {
      P2002: [409, "A record with those unique details already exists"],
      P2003: [409, "Related record does not exist or is still in use"],
      P2025: [404, "Resource not found"],
      P2034: [409, "Concurrent update. Please retry"],
    };
    const mapped = errors[error.code];
    if (mapped) {
      response.status(mapped[0]).json({ success: false, message: mapped[1] });
      return;
    }
  }
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
  // Do not expose request data, database errors or secrets to API consumers/logs.
  console.error("An unexpected request error occurred");
  response.status(500).json({ success: false, message: "Internal server error" });
};
