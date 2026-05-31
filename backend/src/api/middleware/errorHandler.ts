import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../../types/errors";
import { logger } from "../../utils/logger";
import { env } from "../../config/env";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  const dbHint =
    err.message.includes("Tenant or user not found") ||
    err.message.includes("password authentication failed")
      ? "Database connection failed. Copy fresh credentials from Supabase → Settings → Database → Connection string (update DB_HOST, DB_USER, DB_PASSWORD in backend/.env)."
      : null;

  // Unexpected error
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    message:
      dbHint ??
      (env.NODE_ENV === "production" ? "Internal server error" : err.message),
  });
}
