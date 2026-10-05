import "dotenv/config";
import { z } from "zod";

const originSchema = z.string().url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}, "Use an HTTP(S) origin without a path or trailing slash");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CORS_ORIGINS: z.string().default("http://localhost:3000")
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(originSchema).min(1)),
});

export function loadEnvironment(values: NodeJS.ProcessEnv = process.env) {
  const result = environmentSchema.safeParse(values);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path[0]))];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  return result.data;
}

const authEnvironmentSchema = z.object({
  DATABASE_URL: z.string().trim().refine((value) => {
    if (!URL.canParse(value)) return false;
    return ["postgres:", "postgresql:"].includes(new URL(value).protocol);
  }, "Use a PostgreSQL connection URL"),
  JWT_SECRET: z.string().trim().min(32),
  JWT_EXPIRES_IN: z.enum(["15m", "1h", "8h", "1d"]).default("1h"),
});

export function loadAuthEnvironment(values: NodeJS.ProcessEnv = process.env) {
  const databaseUrl = values.DATABASE_URL?.trim();
  const jwtSecret = values.JWT_SECRET?.trim();
  if (!databaseUrl && !jwtSecret && values.NODE_ENV !== "production") return undefined;
  const result = authEnvironmentSchema.safeParse(values);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path[0]))];
    throw new Error(`Invalid authentication configuration: ${fields.join(", ")}`);
  }
  return result.data;
}
