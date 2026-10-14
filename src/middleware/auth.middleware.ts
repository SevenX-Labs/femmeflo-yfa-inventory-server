import type { RequestHandler } from "express";
import type { AuthService } from "../services/auth/auth.service.js";

export function requireAuthentication(auth: AuthService): RequestHandler {
  return async (request, response, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? "");
    const token = match?.[1] || (typeof request.query?.["token"] === "string" ? request.query["token"] : undefined);
    if (!token) {
      response.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    try {
      const user = await auth.authenticate(token);
      if (!user) {
        response.status(401).json({ success: false, message: "Invalid or expired token" });
        return;
      }
      response.locals.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = requireAuthentication;
