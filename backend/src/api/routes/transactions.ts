import { Router } from "express";
import multer from "multer";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionFilterSchema,
} from "../../utils/validation";
import { TransactionService } from "../../services/TransactionService";
import { CsvImportService } from "../../services/CsvImportService";

const router = Router();
const txnService = new TransactionService();
const csvImportService = new CsvImportService();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// GET /api/transactions
router.get(
  "/",
  validate(transactionFilterSchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, limit, ...filters } = req.query as unknown as {
      page: number;
      limit: number;
      type?: "INCOME" | "EXPENSE";
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      minAmount?: number;
      maxAmount?: number;
    };
    const result = await txnService.list(req.user.userId, filters, page, limit);
    res.json({
      success: true,
      data: result.data,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  })
);

// GET /api/transactions/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const txn = await txnService.getById(String(req.params.id), req.user.userId);
  res.json({ success: true, data: txn });
}));

// POST /api/transactions
router.post(
  "/",
  validate(createTransactionSchema),
  asyncHandler(async (req, res) => {
    const txn = await txnService.create(req.user.userId, req.body);
    res.status(201).json({ success: true, data: txn });
  })
);

// POST /api/transactions/import — CSV upload
router.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }
    if (!file.originalname.endsWith(".csv")) {
      res.status(400).json({ success: false, message: "Only .csv files are accepted" });
      return;
    }
    const result = await csvImportService.importTransactions(req.user.userId, file.buffer);
    res.json({ success: true, data: result });
  })
);

// PATCH /api/transactions/:id
router.patch(
  "/:id",
  validate(updateTransactionSchema),
  asyncHandler(async (req, res) => {
    const txn = await txnService.update(String(req.params.id), req.user.userId, req.body);
    res.json({ success: true, data: txn });
  })
);

// DELETE /api/transactions/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  await txnService.delete(String(req.params.id), req.user.userId);
  res.json({ success: true, message: "Deleted" });
}));

export { router as transactionRoutes };
