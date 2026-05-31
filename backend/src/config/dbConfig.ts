import type { PoolConfig } from "pg";
import { env } from "./env";

/** Build pg Pool config — split vars avoid @ in password breaking DATABASE_URL. */
export function getDatabasePoolConfig(): PoolConfig {
  const base: PoolConfig = {
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  };

  const sslFor = (hostOrUrl: string) =>
    hostOrUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined;

  // Split vars first — password can contain @ and matches Hostinger setup
  if (env.DB_HOST && env.DB_USER && env.DB_PASSWORD) {
    const ssl =
      env.DB_SSL === true ||
      (env.DB_SSL !== false && env.DB_HOST.includes("supabase"))
        ? { rejectUnauthorized: false }
        : undefined;

    return {
      ...base,
      host: env.DB_HOST,
      port: env.DB_PORT ?? 6543,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl,
    };
  }

  if (!env.DATABASE_URL) {
    throw new Error(
      "Database not configured: set DB_HOST, DB_USER, DB_PASSWORD (recommended) or DATABASE_URL",
    );
  }

  return {
    ...base,
    connectionString: env.DATABASE_URL,
    ssl: sslFor(env.DATABASE_URL),
  };
}

/** Safe log line for startup (no password). */
export function getDatabaseConnectionLabel(): string {
  if (env.DB_HOST && env.DB_USER) {
    return `${env.DB_USER}@${env.DB_HOST}:${env.DB_PORT ?? 6543}/${env.DB_NAME}`;
  }
  try {
    const url = new URL(env.DATABASE_URL!.replace(/^postgresql:/, "http:"));
    return `${url.username}@${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch {
    return "(DATABASE_URL)";
  }
}
