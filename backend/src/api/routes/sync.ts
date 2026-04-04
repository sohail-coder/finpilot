import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { BankSyncService } from "../../services/BankSyncService";

const router = Router();
const bankSyncService = new BankSyncService();

// POST /api/sync/bank — trigger a bank sync via a provider
router.post(
  "/bank",
  asyncHandler(async (req, res) => {
    const provider = (req.body.provider as string) || "mock";
    const result = await bankSyncService.triggerSync(req.user.userId, provider);
    res.status(201).json({ success: true, data: result });
  }),
);

// GET /api/sync/history — list past sync attempts
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const history = await bankSyncService.getSyncHistory(req.user.userId);
    res.json({ success: true, data: history });
  }),
);

// GET /api/sync/providers — list available providers
router.get(
  "/providers",
  asyncHandler(async (_req, res) => {
    const providers = bankSyncService.getProviders();
    res.json({ success: true, data: providers });
  }),
);

// GET /api/sync/accounts?provider=mock — list bank accounts from a provider
router.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    const provider = (req.query.provider as string) || "mock";
    const accounts = await bankSyncService.getAccounts(req.user.userId, provider);
    res.json({ success: true, data: accounts });
  }),
);

// DELETE /api/sync/purge — remove all synced transactions and logs
router.delete(
  "/purge",
  asyncHandler(async (req, res) => {
    const count = await bankSyncService.purgeAllSynced(req.user.userId);
    res.json({ success: true, data: { deleted: count } });
  }),
);

export { router as syncRoutes };
