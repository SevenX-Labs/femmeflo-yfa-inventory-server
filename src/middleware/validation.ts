import { z } from "zod";

export const passwordSchema = z.string().min(12).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 72,
  "Password must not exceed 72 UTF-8 bytes",
);
export const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use an international phone number, e.g. +919876543210");
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
export const idSchema = z.uuid();

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(400, result.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; "));
  }
  return result.data;
}
