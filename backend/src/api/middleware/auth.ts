import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../utils/jwt";
import { AuthError } from "../../types/errors";

export interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new AuthError("Missing authentication token");
    }

    const payload = verifyToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    next(new AuthError());
  }
}
