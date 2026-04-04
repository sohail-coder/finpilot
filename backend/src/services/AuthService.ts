import { UserRepository, CategoryRepository } from "../repositories";
import { hashPassword, comparePassword } from "../utils/password";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import { AuthError, ConflictError } from "../types/errors";
import { DEFAULT_CATEGORIES } from "../config/constants";
import { logger } from "../utils/logger";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";

const userRepo = new UserRepository();
const categoryRepo = new CategoryRepository();

export class AuthService {
  async register(data: {
    email: string;
    name: string;
    password: string;
    baseCurrency: string;
  }) {
    const existing = await userRepo.findByEmail(data.email);
    if (existing) throw new ConflictError("Email already registered");

    const passwordHash = await hashPassword(data.password);
    const user = await userRepo.create({
      email: data.email,
      name: data.name,
      passwordHash,
      baseCurrency: data.baseCurrency,
    });

    // Seed default categories for the new user
    try {
      for (const name of DEFAULT_CATEGORIES.income) {
        await categoryRepo.create({ userId: user.id, name, categoryType: "INCOME" });
      }
      for (const name of DEFAULT_CATEGORIES.expense) {
        await categoryRepo.create({ userId: user.id, name, categoryType: "EXPENSE" });
      }
      logger.info(`Created default categories for user ${user.id}`);
    } catch (err) {
      logger.warn("Failed to seed default categories", err);
    }

    const payload = { userId: user.id, email: user.email };
    return {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async login(email: string, password: string) {
    const user = await userRepo.findByEmail(email);
    if (!user || user.deletedAt) throw new AuthError("Invalid credentials");

    if (!user.passwordHash) throw new AuthError("Invalid credentials");
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new AuthError("Invalid credentials");

    const payload = { userId: user.id, email: user.email };
    return {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async googleLogin(idToken: string) {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AuthError("Google login is not configured");
    }

    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const googlePayload = ticket.getPayload();
    if (!googlePayload || !googlePayload.email) {
      throw new AuthError("Invalid Google token");
    }

    const { email, name, sub: googleId } = googlePayload;

    // Check if user exists by email
    let user = await userRepo.findByEmail(email);

    if (user) {
      // Link Google ID if not already linked
      if (!user.googleId) {
        await userRepo.update(user.id, { googleId });
      }
    } else {
      // Create new user without password
      user = await userRepo.create({
        email,
        name: name || email.split("@")[0],
        passwordHash: null as unknown as string,
        baseCurrency: "USD",
        googleId,
      });

      // Seed default categories
      try {
        for (const catName of DEFAULT_CATEGORIES.income) {
          await categoryRepo.create({ userId: user.id, name: catName, categoryType: "INCOME" });
        }
        for (const catName of DEFAULT_CATEGORIES.expense) {
          await categoryRepo.create({ userId: user.id, name: catName, categoryType: "EXPENSE" });
        }
        logger.info(`Created default categories for Google user ${user.id}`);
      } catch (err) {
        logger.warn("Failed to seed default categories", err);
      }
    }

    const payload = { userId: user.id, email: user.email };
    return {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async getProfile(userId: string) {
    return userRepo.findById(userId);
  }
}
