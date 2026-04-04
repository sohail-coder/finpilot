import type { Request, Response, NextFunction } from "express";
import { logger } from "../../utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    logger.http(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
    });
  });

  next();
}
