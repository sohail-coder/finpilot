import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  // Option A: single URL (password must be URL-encoded, e.g. @ → %40)
  DATABASE_URL: z.string().min(10).optional(),
  // Option B: split vars (password can contain @ — recommended for Hostinger)
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().default("postgres"),
  DB_SSL: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  DIRECT_URL: z.string().min(10).optional(),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "debug"])
    .default("info"),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  APP_URL: z.string().default("http://localhost:5173"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

const hasSplitDb =
  parsed.success &&
  !!parsed.data.DB_HOST &&
  !!parsed.data.DB_USER &&
  !!parsed.data.DB_PASSWORD;
const hasDatabaseUrl = parsed.success && !!parsed.data.DATABASE_URL;

if (parsed.success && !hasSplitDb && !hasDatabaseUrl) {
  console.error(
    "[finpilot] Database config missing: set DB_HOST, DB_USER, DB_PASSWORD (recommended) or DATABASE_URL",
  );
  process.exit(1);
}

if (!parsed.success) {
  console.error("[finpilot] Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
