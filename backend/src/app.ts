import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { apiRouter } from "./api/routes";
import { errorHandler } from "./api/middleware/errorHandler";
import { requestLogger } from "./api/middleware/requestLogger";

const app = express();

// Comma-separated in env, e.g. CORS_ORIGIN=https://finpilot.accrescentgroup.com
const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

// --------------- Global middleware ---------------
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) {
        callback(null, origin);
        return;
      }
      // Vite proxy / local tooling may send http://localhost:3000 etc.
      if (
        env.NODE_ENV === "development" &&
        /^http:\/\/localhost(:\d+)?$/.test(normalized)
      ) {
        callback(null, origin);
        return;
      }
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

// --------------- Health check ---------------
app.get("/health", async (_req, res) => {
  try {
    const { prisma } = await import("./config/database");
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "degraded",
      database: "disconnected",
      timestamp: new Date().toISOString(),
      hint: "Check DATABASE_URL in Hostinger environment variables",
    });
  }
});

// --------------- API routes ---------------
app.use("/api", apiRouter);

// --------------- Error handler (must be last) ---------------
app.use(errorHandler);

export { app };
