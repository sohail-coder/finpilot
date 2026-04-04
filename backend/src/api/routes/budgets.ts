import { Router } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { createBudgetSchema, updateBudgetSchema } from "../../utils/validation";
import { BudgetService } from "../../services/BudgetService";

const router = Router();
const budgetService = new BudgetService();

// GET /api/budgets?month=YYYY-MM
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const budgets = await budgetService.list(
      req.user.userId,
      req.query.month as string | undefined,
    );
    res.json({ success: true, data: budgets });
  }),
);

// GET /api/budgets/status?month=YYYY-MM
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const status = await budgetService.getStatus(
      req.user.userId,
      String(req.query.month),
    );
    res.json({ success: true, data: status });
  }),
);

// POST /api/budgets
router.post(
  "/",
  validate(createBudgetSchema),
  asyncHandler(async (req, res) => {
    const budget = await budgetService.create(req.user.userId, req.body);
    res.status(201).json({ success: true, data: budget });
  }),
);

// PATCH /api/budgets/:id
router.patch(
  "/:id",
  validate(updateBudgetSchema),
  asyncHandler(async (req, res) => {
    const budget = await budgetService.update(
      String(req.params.id),
      req.user.userId,
      req.body,
    );
    res.json({ success: true, data: budget });
  }),
);

// DELETE /api/budgets/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await budgetService.delete(String(req.params.id), req.user.userId);
    res.json({ success: true, message: "Deleted" });
  }),
);

export { router as budgetRoutes };
