import { Router } from "express";
import { createAuthController } from "../../controller/auth/auth.controller.js";
import { requireAuthentication } from "../../middleware/auth.middleware.js";
import type { AuthService } from "../../services/auth/auth.service.js";
import { rateLimit } from "express-rate-limit";

export function createAuthRoutes(auth: AuthService) {
  const routes = Router();
  routes.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  const controller = createAuthController(auth);
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
    message: { success: false, message: "Too many authentication attempts. Try again later" },
  });
  routes.post("/login", limit, controller.login);
  routes.post("/forgot-password", limit, controller.forgotPassword);
  routes.post("/reset-password", limit, controller.resetPassword);
  routes.get("/me", requireAuthentication(auth), controller.me);
  routes.patch("/password", limit, requireAuthentication(auth), controller.changePassword);
  return routes;
}

