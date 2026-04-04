import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ReportService } from "../../services/ReportService";
import { TransactionRepository } from "../../repositories";

const router = Router();
const reportService = new ReportService();
const txnRepo = new TransactionRepository();

// GET /api/reports/pdf?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get(
  "/pdf",
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: "startDate and endDate are required" });
      return;
    }

    const pdfBuffer = await reportService.generateReport(
      req.user.userId,
      startDate,
      endDate,
    );

    const filename = `finpilot-report-${startDate}-to-${endDate}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  }),
);

// GET /api/reports/csv?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get(
  "/csv",
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const filters: { startDate?: Date; endDate?: Date } = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const result = await txnRepo.findByUserId(req.user.userId, filters, 1, 10000);

    const header = "date,description,category,type,amount,currency,base_amount\n";
    const rows = result.data.map((tx) => {
      const date = new Date(tx.transactionDate).toISOString().slice(0, 10);
      const desc = `"${(tx.description ?? "").replace(/"/g, '""')}"`;
      const cat = `"${(tx.category?.name ?? "").replace(/"/g, '""')}"`;
      const type = tx.transactionType;
      const amount = Number(tx.amount).toFixed(2);
      const currency = tx.currency;
      const baseAmount = Number(tx.baseCurrencyAmount).toFixed(2);
      return `${date},${desc},${cat},${type},${amount},${currency},${baseAmount}`;
    });

    const csv = header + rows.join("\n");
    const label = startDate && endDate ? `${startDate}-to-${endDate}` : "all";
    const filename = `finpilot-transactions-${label}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  }),
);

// ── Report Schedule ─────────────────────────────────────────

// GET /api/reports/schedule — get current user's schedule
router.get(
  "/schedule",
  asyncHandler(async (req, res) => {
    const schedule = await reportService.getSchedule(req.user.userId);
    res.json({ success: true, data: schedule });
  }),
);

// POST /api/reports/schedule — create or update schedule
router.post(
  "/schedule",
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      res.status(400).json({ success: false, message: "Email is required" });
      return;
    }
    const schedule = await reportService.upsertSchedule(req.user.userId, email);
    res.json({ success: true, data: schedule });
  }),
);

// DELETE /api/reports/schedule — deactivate schedule
router.delete(
  "/schedule",
  asyncHandler(async (req, res) => {
    await reportService.deleteSchedule(req.user.userId);
    res.json({ success: true, message: "Report schedule deactivated" });
  }),
);

export { router as reportRoutes };
