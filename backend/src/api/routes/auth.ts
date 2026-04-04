import { Router, type Request, type Response } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { registerSchema, loginSchema } from "../../utils/validation";
import { AuthService } from "../../services/AuthService";
import { verifyToken } from "../../utils/jwt";
import { env } from "../../config/env";

const router = Router();
const authService = new AuthService();

// POST /api/auth/register
router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ success: true, data: result.user });
  }),
);

// POST /api/auth/login
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 min
    });
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.json({ success: true, data: result.user });
  }),
);

// POST /api/auth/google
router.post(
  "/google",
  asyncHandler(async (req, res) => {
    const { credential } = req.body;
    if (!credential || typeof credential !== "string") {
      res.status(400).json({ success: false, message: "Missing Google credential" });
      return;
    }
    const result = await authService.googleLogin(credential);
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, data: result.user });
  }),
);

// GET /api/auth/google-client-id
router.get("/google-client-id", (_req: Request, res: Response) => {
  res.json({ success: true, data: { clientId: env.GOOGLE_CLIENT_ID || null } });
});

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logged out" });
});

// GET /api/auth/me — returns null when not authenticated (no 401)
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      res.json({ success: true, data: null });
      return;
    }

    try {
      const payload = verifyToken(token);
      const profile = await authService.getProfile(payload.userId);
      res.json({ success: true, data: profile });
    } catch {
      res.json({ success: true, data: null });
    }
  }),
);

export { router as authRoutes };
