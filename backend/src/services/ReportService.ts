import { generatePdfBuffer, type ReportData, type CategoryRow, type TransactionRow } from "../utils/pdfGenerator";
import { DashboardRepository, TransactionRepository } from "../repositories";
import { ReportScheduleRepository } from "../repositories/ReportScheduleRepository";
import { sendEmail } from "../utils/email";
import { logger } from "../utils/logger";
import { env } from "../config/env";

const dashboardRepo = new DashboardRepository();
const txnRepo = new TransactionRepository();
const scheduleRepo = new ReportScheduleRepository();

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export class ReportService {
  /**
   * Generate a PDF financial report for the given date range.
   * Pulls summary totals, category breakdown, and transactions.
   */
  async generateReport(userId: string, startDate: string, endDate: string): Promise<Buffer> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch data in parallel — all queries are independent
    const [totals, categoryRows, txResult] = await Promise.all([
      dashboardRepo.getIncomeExpenseTotals(userId, start, end),
      dashboardRepo.getCategoryBreakdown(userId, start, end, 20),
      txnRepo.findByUserId(userId, { startDate: start, endDate: end }, 1, 200),
    ]);

    // Compute summary
    let totalIncome = 0;
    let totalExpense = 0;
    let txnCount = 0;
    for (const row of totals) {
      const amount = Number(row._sum.baseCurrencyAmount ?? 0);
      txnCount += row._count;
      if (row.transactionType === "INCOME") totalIncome = amount;
      else totalExpense = amount;
    }

    const totalExpenseAbs = Math.abs(totalExpense);

    // Build category rows (top 4)
    const categories: CategoryRow[] = categoryRows.slice(0, 4).map((c) => ({
      name: c.category_name,
      total: fmt(c.total),
      percent: totalExpenseAbs > 0 ? `${((c.total / totalExpenseAbs) * 100).toFixed(1)}%` : "0%",
      percentNum: totalExpenseAbs > 0 ? (c.total / totalExpenseAbs) * 100 : 0,
    }));

    // Build transaction rows — last 5 recent
    const recentTxns = txResult.data
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      .slice(0, 5);

    const transactions: TransactionRow[] = recentTxns.map((tx) => ({
      date: new Date(tx.transactionDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      description: tx.description ?? "-",
      descriptionSub: tx.category?.name ?? "",
      category: tx.category?.name ?? "-",
      type: tx.transactionType,
      amount: fmt(Math.abs(Number(tx.baseCurrencyAmount))),
    }));

    // Generate document ID
    const now = new Date();
    const docId = `FP-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`;

    // Net savings
    const netSavings = totalIncome - totalExpenseAbs;
    const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(0) : "0";
    const savingsMessage = `Your savings rate is ${savingsRate}% for this period.`;

    const reportData: ReportData = {
      title: "Monthly Financial Overview",
      dateRange: `${start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      generatedAt: new Date(),
      documentId: docId,
      totalIncome: `$${fmt(totalIncome)}`,
      totalExpenses: `$${fmt(totalExpenseAbs)}`,
      netSavings: `$${fmt(netSavings)}`,
      savingsMessage,
      categories,
      transactions,
      appUrl: env.APP_URL,
    };

    return generatePdfBuffer(reportData);
  }

  // ── Schedule CRUD ───────────────────────────────────────
  async getSchedule(userId: string) {
    return scheduleRepo.findByUserId(userId);
  }

  async upsertSchedule(userId: string, email: string) {
    const schedule = await scheduleRepo.upsert(userId, email);

    // Send current month's report immediately (fire-and-forget)
    this.sendImmediateReport(userId, email).catch((err) => {
      logger.error(`Failed to send immediate report for user ${userId}`, err);
    });

    return schedule;
  }

  async deleteSchedule(userId: string) {
    return scheduleRepo.deactivate(userId);
  }

  // ── Send current month report immediately ────────────────
  async sendImmediateReport(userId: string, email: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);

    const pdfBuffer = await this.generateReport(userId, startDate, endDate);
    const monthLabel = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    await sendEmail({
      to: email,
      subject: `FinPilot Report — ${monthLabel} (so far)`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4338ca;">FinPilot Report</h2>
          <p>Your financial report for <strong>${monthLabel}</strong> (month-to-date) is attached.</p>
          <p style="color: #6b7280; font-size: 14px;">You'll automatically receive a full report on the 1st of every month going forward.</p>
        </div>
      `,
      attachments: [{
        filename: `finpilot-report-${startDate}-to-${endDate}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      }],
    });

    logger.info(`Immediate report sent to ${email} for user ${userId}`);
  }

  // ── Monthly email job ───────────────────────────────────
  async sendScheduledReports() {
    const schedules = await scheduleRepo.findAllActive();
    logger.info(`Running monthly report job for ${schedules.length} schedule(s)`);

    for (const schedule of schedules) {
      try {
        // Previous month date range
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
        const startDate = start.toISOString().slice(0, 10);
        const endDate = end.toISOString().slice(0, 10);

        const pdfBuffer = await this.generateReport(schedule.userId, startDate, endDate);
        const monthLabel = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        await sendEmail({
          to: schedule.email,
          subject: `FinPilot Monthly Report — ${monthLabel}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4338ca;">FinPilot Monthly Report</h2>
              <p>Hi${schedule.user?.name ? ` ${schedule.user.name}` : ""},</p>
              <p>Your financial report for <strong>${monthLabel}</strong> is attached.</p>
              <p style="color: #6b7280; font-size: 14px;">This is an automated report from FinPilot. You can manage your report schedule in the app.</p>
            </div>
          `,
          attachments: [{
            filename: `finpilot-report-${startDate}-to-${endDate}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          }],
        });

        await scheduleRepo.updateLastSent(schedule.id);
        logger.info(`Monthly report sent to ${schedule.email} for user ${schedule.userId}`);
      } catch (err) {
        logger.error(`Failed to send scheduled report for user ${schedule.userId}`, err);
      }
    }
  }
}
