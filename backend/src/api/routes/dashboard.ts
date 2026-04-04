import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { dashboardQuerySchema } from "../../utils/validation";
import { DashboardService } from "../../services/DashboardService";

const router = Router();
const dashboardService = new DashboardService();

// GET /api/dashboard?startDate=...&endDate=...
router.get(
  "/",
  validate(dashboardQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const summary = await dashboardService.getSummary(
      req.user.userId,
      req.query.startDate as string,
      req.query.endDate as string,
    );
    res.json({ success: true, data: summary });
  }),
);

export { router as dashboardRoutes };
