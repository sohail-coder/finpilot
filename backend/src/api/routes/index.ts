import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authRoutes } from "./auth";
import { transactionRoutes } from "./transactions";
import { categoryRoutes } from "./categories";
import { budgetRoutes } from "./budgets";
import { dashboardRoutes } from "./dashboard";
import { reportRoutes } from "./reports";
import { syncRoutes } from "./sync";
import { aiRoutes } from "./ai";

const router = Router();

// Public routes
router.use("/auth", authRoutes);

// Protected routes — all require authentication
router.use("/transactions", authenticate, transactionRoutes);
router.use("/categories", authenticate, categoryRoutes);
router.use("/budgets", authenticate, budgetRoutes);
router.use("/dashboard", authenticate, dashboardRoutes);
router.use("/reports", authenticate, reportRoutes);
router.use("/sync", authenticate, syncRoutes);
router.use("/ai", authenticate, aiRoutes);

export { router as apiRouter };
