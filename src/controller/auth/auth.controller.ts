import type { RequestHandler } from "express";
import { z } from "zod";
import { AuthenticationError, type AuthService } from "../../services/auth/auth.service.js";
import type { PublicUser } from "../../services/auth/auth.types.js";
import { parseInput, passwordSchema } from "../../middleware/validation.js";

const loginBody = z.strictObject({
  login: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(1024),
});

const forgotPasswordBody = z.strictObject({
  login: z.string().trim().min(1).max(254),
});

const resetPasswordBody = z.strictObject({
  token: z.string().trim().min(1).max(256),
  newPassword: passwordSchema,
});

export function createAuthController(auth: AuthService) {
  const login: RequestHandler = async (request, response, next) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ success: false, message: "Provide login and password" });
      return;
    }
    try {
      const data = await auth.login(parsed.data.login, parsed.data.password);
      response.json({ success: true, message: "Login successful", data });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        response.status(401).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  const me: RequestHandler = (_request, response) => {
    const user = response.locals.authUser as PublicUser;
    response.json({ success: true, message: "Current user", data: { user } });
  };

  const changePassword: RequestHandler = async (request, response) => {
    const input = parseInput(z.strictObject({ currentPassword: z.string().min(1).max(1024), newPassword: passwordSchema }), request.body);
    await auth.changePassword((response.locals.authUser as PublicUser).id, input.currentPassword, input.newPassword);
    response.json({ success: true, message: "Password changed. Log in again", data: {} });
  };

  const forgotPassword: RequestHandler = async (request, response) => {
    const input = parseInput(forgotPasswordBody, request.body);
    const result = await auth.forgotPassword(input.login);
    response.json(result);
  };

  const resetPassword: RequestHandler = async (request, response) => {
    const input = parseInput(resetPasswordBody, request.body);
    const result = await auth.resetPassword(input.token, input.newPassword);
    response.json(result);
  };

  return { login, me, changePassword, forgotPassword, resetPassword };
}

