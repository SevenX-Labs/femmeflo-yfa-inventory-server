import { z } from "zod";

export const passwordSchema = z.string().min(12).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 72,
  "Password must not exceed 72 UTF-8 bytes",
);

/**
 * 10-digit mobile phone validator and normalizer.
 * Supports:
 * - 10 digits starting with 6-9: 9876543210 -> +919876543210
 * - Leading 0: 09876543210 -> +919876543210
 * - With +91: +919876543210 -> +919876543210
 * - International numbers: +[1-9]\d{8,14}
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s\-()]/g, ""))
  .refine(
    (val) => {
      if (/^\+91[6-9]\d{9}$/.test(val)) return true;
      if (/^[6-9]\d{9}$/.test(val)) return true;
      if (/^0[6-9]\d{9}$/.test(val)) return true;
      if (/^\+[1-9]\d{8,14}$/.test(val)) return true;
      return false;
    },
    { message: "Please enter a valid 10-digit mobile number, e.g. 9876543210 or +919876543210" }
  )
  .transform((val) => {
    if (/^[6-9]\d{9}$/.test(val)) return `+91${val}`;
    if (/^0([6-9]\d{9})$/.test(val)) return `+91${val.slice(1)}`;
    return val;
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: "Please provide a valid email address, e.g. user@example.com" }
  )
  .transform((val) => (val === "" ? undefined : val));

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
