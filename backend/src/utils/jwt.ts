import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as unknown as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}

export function signRefreshToken(payload: TokenPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as unknown as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
