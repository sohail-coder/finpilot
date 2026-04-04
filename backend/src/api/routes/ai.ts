import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { SavingsAIService } from "../../services/SavingsAIService";
import { CreditCardAIService } from "../../services/CreditCardAIService";

const router = Router();
const aiService = new SavingsAIService();
const creditCardService = new CreditCardAIService();

const generatePlanSchema = z.object({
  savingsGoal: z.number().positive("Savings goal must be positive"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// POST /api/ai/savings-plan
router.post(
  "/savings-plan",
  validate(generatePlanSchema),
  asyncHandler(async (req, res) => {
    const { savingsGoal, startDate, endDate } = req.body;
    const plan = await aiService.generatePlan(
      req.user.userId,
      savingsGoal,
      startDate,
      endDate,
    );
    res.json({ success: true, data: plan });
  }),
);

// GET /api/ai/history
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const history = await aiService.getHistory(req.user.userId);
    res.json({ success: true, data: history });
  }),
);

// PATCH /api/ai/:id/status
router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const status = req.body.status;
    if (status !== "ACCEPTED" && status !== "DISMISSED") {
      res.status(400).json({ success: false, message: "Status must be ACCEPTED or DISMISSED" });
      return;
    }
    await aiService.updateStatus(String(req.params.id), req.user.userId, status);
    res.json({ success: true, message: "Status updated" });
  }),
);

// DELETE /api/ai/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await aiService.deletePlan(String(req.params.id), req.user.userId);
    res.json({ success: true, message: "Plan deleted" });
  }),
);

// GET /api/ai/credit-cards
router.get(
  "/credit-cards",
  asyncHandler(async (req, res) => {
    const insight = await creditCardService.recommend(req.user.userId);
    res.json({ success: true, data: insight });
  }),
);

export { router as aiRoutes };
