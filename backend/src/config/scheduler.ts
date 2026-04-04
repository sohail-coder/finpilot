import cron from "node-cron";
import { ReportService } from "../services/ReportService";
import { logger } from "../utils/logger";
import { env } from "../config/env";

const reportService = new ReportService();

/**
 * Start the cron scheduler for automated tasks.
 * Runs on the 1st of every month at 08:00 UTC.
 */
export function startScheduler() {
  // Only run if SMTP is configured
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    logger.info("SMTP not configured — report scheduler disabled");
    return;
  }

  // Cron: "0 8 1 * *" = at 08:00 on day 1 of every month
  cron.schedule("0 8 1 * *", async () => {
    logger.info("Cron: Starting monthly report email job");
    try {
      await reportService.sendScheduledReports();
    } catch (err) {
      logger.error("Cron: Monthly report job failed", err);
    }
  });

  logger.info("Report scheduler started — runs 1st of every month at 08:00 UTC");
}
