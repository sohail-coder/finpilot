import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";

type AsyncRouteHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Wraps an async Express route handler, casting the request to
 * AuthenticatedRequest and forwarding any thrown error to `next()`.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: unknown, res: Response, next: NextFunction) => {
    fn(req as AuthenticatedRequest, res, next).catch(next);
  };
}
