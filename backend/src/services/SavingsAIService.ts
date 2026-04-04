import {
  AIRecommendationRepository,
  DashboardRepository,
  BudgetRepository,
  UserRepository,
} from "../repositories";
import { env } from "../config/env";
import { BUDGET_THRESHOLDS } from "../config/constants";
import { logger } from "../utils/logger";

// ── Types ────────────────────────────────────────────────

interface CategorySummary {
  categoryName: string;
  categoryType: "INCOME" | "EXPENSE";
  monthlyAvg: number;
  percentOfExpenses: number;
  trend: "rising" | "stable" | "falling";
  monthlyTotals: Record<string, number>;
  isFixed: boolean;
}

interface BudgetContext {
  categoryName: string;
  budgetAmount: number;
  spentThisMonth: number;
  percentUsed: number;
}

interface SavingsInput {
  baseCurrency: string;
  savingsGoal: number;
  monthsAnalyzed: number;
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  categories: CategorySummary[];
  budgetContext: BudgetContext[];
}

/** Shape required from LLM / rule engine */
export interface AIPlanResponse {
  summary: string;
  recommendations: {
    category: string;
    currentSpending: number;
    suggestedTarget: number;
    potentialSavings: number;
    rationale: string;
    priority: "high" | "medium" | "low";
  }[];
  estimatedMonthlySavings: number;
  currentMonthlySavings: number;
  cautionNotes: string[];
}

// ── Repos / config ───────────────────────────────────────

const aiRepo = new AIRecommendationRepository();
const dashboardRepo = new DashboardRepository();
const budgetRepo = new BudgetRepository();
const userRepo = new UserRepository();

const FIXED_CATEGORIES = new Set([
  "housing",
  "utilities",
  "healthcare",
  "education",
  "insurance",
]);

// ── Service ──────────────────────────────────────────────

export class SavingsAIService {
  // ─────────────────────── Public API ───────────────────

  async generatePlan(
    userId: string,
    savingsGoal: number,
    startDate?: string,
    endDate?: string,
  ): Promise<AIPlanResponse & { id: string; source: "ai" | "rules" | "insufficient_data" }> {
    const input = await this.preprocess(userId, savingsGoal, startDate, endDate);

    // Insufficient data guard
    const currentMonthlySavings = Math.round(
      ((input.totalIncome - input.totalExpense) / Math.max(input.monthsAnalyzed, 1)) * 100,
    ) / 100;

    if (input.monthsAnalyzed === 0 || input.totalExpense === 0) {
      const empty: AIPlanResponse = {
        summary:
          "Not enough transaction data yet. Keep tracking for at least one month to get savings insights.",
        recommendations: [],
        estimatedMonthlySavings: 0,
        currentMonthlySavings: 0,
        cautionNotes: [],
      };
      const rec = await this.persist(userId, input, empty, "insufficient_data");
      return { ...empty, id: rec.id, source: "insufficient_data" };
    }

    // Try LLM
    let plan: AIPlanResponse | null = null;
    let source: "ai" | "rules" = "rules";

    if (env.OPENAI_API_KEY) {
      try {
        plan = await this.callLLM(input);
        source = "ai";
        logger.info("AI savings plan generated via LLM");
      } catch (err) {
        logger.warn("LLM call failed, falling back to rules", err);
      }
    } else {
      logger.info("No OPENAI_API_KEY configured — using rule engine");
    }

    // Fallback
    if (!plan) {
      plan = this.ruleEngine(input);
      source = "rules";
    }

    // Inject currentMonthlySavings into the plan
    plan.currentMonthlySavings = currentMonthlySavings;

    const rec = await this.persist(userId, input, plan, source);
    return { ...plan, id: rec.id, source };
  }

  async getHistory(userId: string) {
    return aiRepo.findByUserId(userId);
  }

  async updateStatus(id: string, userId: string, status: "ACCEPTED" | "DISMISSED") {
    return aiRepo.updateStatus(id, userId, status);
  }

  async deletePlan(id: string, userId: string) {
    return aiRepo.deleteByIdAndUser(id, userId);
  }

  // ─────────────────── Preprocessing ────────────────────

  private async preprocess(
    userId: string,
    savingsGoal: number,
    startDate?: string,
    endDate?: string,
  ): Promise<SavingsInput> {
    const now = new Date();
    const end = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const user = await userRepo.findById(userId);
    const baseCurrency = user?.baseCurrency ?? "USD";

    const [totals, categoryMonthly, budgets, spentRows] = await Promise.all([
      dashboardRepo.getIncomeExpenseTotals(userId, start, end),
      dashboardRepo.getCategoryMonthlyBreakdown(userId, start, end),
      budgetRepo.findByUserId(userId, new Date(now.getFullYear(), now.getMonth(), 1)),
      budgetRepo.sumSpentByCategory(
        userId,
        new Date(now.getFullYear(), now.getMonth(), 1),
        new Date(now.getFullYear(), now.getMonth() + 1, 1),
      ),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    for (const row of totals) {
      const amt = Number(row._sum.baseCurrencyAmount ?? 0);
      if (row.transactionType === "INCOME") totalIncome = amt;
      else totalExpense = amt;
    }

    const monthSet = new Set<string>();
    for (const row of categoryMonthly) monthSet.add(row.month);
    const sortedMonths = Array.from(monthSet).sort();
    const monthsAnalyzed = sortedMonths.length;

    // Pivot: categoryId → { name, type, monthTotals, total }
    const catMap = new Map<
      string,
      { name: string; type: string; months: Map<string, number>; total: number }
    >();
    for (const row of categoryMonthly) {
      let entry = catMap.get(row.category_id);
      if (!entry) {
        entry = { name: row.category_name, type: row.category_type, months: new Map(), total: 0 };
        catMap.set(row.category_id, entry);
      }
      entry.months.set(row.month, row.total);
      entry.total += row.total;
    }

    const categories: CategorySummary[] = [];
    for (const [, entry] of catMap) {
      if (entry.type !== "EXPENSE") continue;

      const monthlyTotals: Record<string, number> = {};
      for (const m of sortedMonths) monthlyTotals[m] = entry.months.get(m) ?? 0;

      const monthlyAvg = monthsAnalyzed > 0 ? entry.total / monthsAnalyzed : 0;
      const percentOfExpenses = totalExpense > 0 ? (entry.total / totalExpense) * 100 : 0;
      const trend = this.computeTrend(sortedMonths, entry.months);
      const isFixed = FIXED_CATEGORIES.has(entry.name.toLowerCase());

      categories.push({
        categoryName: entry.name,
        categoryType: "EXPENSE",
        monthlyAvg: Math.round(monthlyAvg * 100) / 100,
        percentOfExpenses: Math.round(percentOfExpenses * 100) / 100,
        trend,
        monthlyTotals,
        isFixed,
      });
    }

    categories.sort((a, b) => b.monthlyAvg - a.monthlyAvg);

    // Budget context
    const spentMap = new Map<string, number>();
    for (const row of spentRows) {
      spentMap.set(row.categoryId, Number(row._sum.baseCurrencyAmount ?? 0));
    }

    const budgetContext: BudgetContext[] = budgets.map((b) => {
      const spent = spentMap.get(b.categoryId) ?? 0;
      return {
        categoryName: b.category.name,
        budgetAmount: Number(b.amount),
        spentThisMonth: spent,
        percentUsed: Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0,
      };
    });

    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    return {
      baseCurrency,
      savingsGoal,
      monthsAnalyzed,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      savingsRate: Math.round(savingsRate * 100) / 100,
      categories,
      budgetContext,
    };
  }

  private computeTrend(
    months: string[],
    monthMap: Map<string, number>,
  ): "rising" | "stable" | "falling" {
    if (months.length < 4) return "stable";

    const mid = Math.floor(months.length / 2);
    const recentMonths = months.slice(mid);
    const priorMonths = months.slice(0, mid);

    const avgRecent =
      recentMonths.reduce((s, m) => s + (monthMap.get(m) ?? 0), 0) / recentMonths.length;
    const avgPrior =
      priorMonths.reduce((s, m) => s + (monthMap.get(m) ?? 0), 0) / priorMonths.length;

    if (avgPrior === 0) return avgRecent > 0 ? "rising" : "stable";
    const change = (avgRecent - avgPrior) / avgPrior;
    if (change > 0.1) return "rising";
    if (change < -0.1) return "falling";
    return "stable";
  }

  // ─────────────────────── LLM Call ─────────────────────

  private async callLLM(input: SavingsInput): Promise<AIPlanResponse> {
    const systemPrompt = `You are a personal finance advisor. You receive a structured JSON summary of a user's spending. Generate a savings plan to help them reach their savings goal.

Rules:
- Only suggest reductions on EXPENSE categories.
- Never recommend reducing Healthcare unless the user has an unusually high percentage (>20% of expenses).
- Categories marked isFixed=true (Housing, Utilities, Healthcare, Education, Insurance) should only get modest suggestions (5-10% max).
- For flexible categories (isFixed=false), suggest 10-25% reductions where trend is "rising" or "stable".
- If a category trend is "falling", acknowledge the improvement and do not suggest further cuts.
- If a category has a budget that is exceeded (percentUsed > 100), prioritize it.
- Be specific with dollar amounts, not vague advice.
- Include 1-3 cautionNotes about risks or things to watch (e.g. "Don't cut grocery spending so much it affects nutrition").
- Respond ONLY with valid JSON matching the schema below. No markdown, no extra text.

Required JSON schema:
{
  "summary": "2-3 sentence overall assessment",
  "recommendations": [
    {
      "category": "exact category name from input",
      "currentSpending": <monthly average number>,
      "suggestedTarget": <recommended monthly spend>,
      "potentialSavings": <currentSpending - suggestedTarget>,
      "rationale": "1-2 sentence explanation",
      "priority": "high" | "medium" | "low"
    }
  ],
  "estimatedMonthlySavings": <sum of all potentialSavings>,
  "cautionNotes": ["string", ...]
}`;

    const userMessage = JSON.stringify({
      baseCurrency: input.baseCurrency,
      savingsGoal: input.savingsGoal,
      monthsAnalyzed: input.monthsAnalyzed,
      totalIncome: input.totalIncome,
      totalExpense: input.totalExpense,
      savingsRate: input.savingsRate,
      categories: input.categories.map((c) => ({
        name: c.categoryName,
        monthlyAvg: c.monthlyAvg,
        percentOfExpenses: c.percentOfExpenses,
        trend: c.trend,
        isFixed: c.isFixed,
      })),
      budgetContext: input.budgetContext,
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as any;
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    return this.validateAIResponse(JSON.parse(content), input);
  }

  // ──────────────────── Response Validation ─────────────

  private validateAIResponse(raw: unknown, input: SavingsInput): AIPlanResponse {
    if (!raw || typeof raw !== "object") throw new Error("AI response is not an object");
    const obj = raw as Record<string, unknown>;

    const summary = typeof obj.summary === "string" ? obj.summary : "";
    const estimatedMonthlySavings =
      typeof obj.estimatedMonthlySavings === "number" ? obj.estimatedMonthlySavings : 0;

    const cautionNotes = Array.isArray(obj.cautionNotes)
      ? (obj.cautionNotes as unknown[]).filter((n): n is string => typeof n === "string")
      : [];

    const validNames = new Set(input.categories.map((c) => c.categoryName.toLowerCase()));

    const recommendations: AIPlanResponse["recommendations"] = [];
    if (Array.isArray(obj.recommendations)) {
      for (const item of obj.recommendations as Record<string, unknown>[]) {
        const cat = String(item.category ?? "");
        if (!validNames.has(cat.toLowerCase())) continue;

        const currentSpending = Math.max(0, Number(item.currentSpending ?? 0));
        const suggestedTarget = Math.max(0, Number(item.suggestedTarget ?? 0));
        const potentialSavings = Math.max(0, Number(item.potentialSavings ?? 0));
        const rationale = typeof item.rationale === "string" ? item.rationale : "";
        const priority = ["high", "medium", "low"].includes(String(item.priority))
          ? (String(item.priority) as "high" | "medium" | "low")
          : "medium";

        recommendations.push({ category: cat, currentSpending, suggestedTarget, potentialSavings, rationale, priority });
      }
    }

    if (!summary && recommendations.length === 0) {
      throw new Error("AI response has no summary and no recommendations");
    }

    return { summary, recommendations, estimatedMonthlySavings: Math.max(0, estimatedMonthlySavings), currentMonthlySavings: 0, cautionNotes };
  }

  // ──────────────── Deterministic Rule Engine ───────────

  private ruleEngine(input: SavingsInput): AIPlanResponse {
    const recommendations: AIPlanResponse["recommendations"] = [];
    const cautionNotes: string[] = [];

    const budgetMap = new Map<string, BudgetContext>();
    for (const b of input.budgetContext) budgetMap.set(b.categoryName.toLowerCase(), b);

    for (const cat of input.categories) {
      if (recommendations.length >= 5) break;
      if (cat.trend === "falling") continue;
      if (cat.percentOfExpenses < 5) continue;
      if (cat.categoryName.toLowerCase() === "healthcare") continue;

      const budget = budgetMap.get(cat.categoryName.toLowerCase());
      let suggestedTarget: number;
      let rationale: string;
      let priority: "high" | "medium" | "low";

      if (budget && budget.percentUsed > BUDGET_THRESHOLDS.DANGER_PERCENT) {
        suggestedTarget = budget.budgetAmount;
        const overage = Math.round(budget.percentUsed - 100);
        rationale = `You've exceeded your ${cat.categoryName} budget by ${overage}%. Bringing spending back to your $${budget.budgetAmount}/mo budget would save money immediately.`;
        priority = "high";
      } else if (cat.isFixed) {
        suggestedTarget = Math.round(cat.monthlyAvg * 0.93 * 100) / 100;
        rationale = `${cat.categoryName} is a fixed expense but a 7% reduction (shopping for better rates, negotiating) could help.`;
        priority = "low";
      } else if (cat.trend === "rising") {
        suggestedTarget = Math.round(cat.monthlyAvg * 0.82 * 100) / 100;
        rationale = `Spending on ${cat.categoryName} has been rising. An 18% reduction would meaningfully contribute to your savings goal.`;
        priority = "high";
      } else {
        suggestedTarget = Math.round(cat.monthlyAvg * 0.88 * 100) / 100;
        rationale = `A 12% reduction in ${cat.categoryName} spending is achievable and would add up over time.`;
        priority = "medium";
      }

      const potentialSavings = Math.round((cat.monthlyAvg - suggestedTarget) * 100) / 100;
      if (potentialSavings <= 0) continue;

      recommendations.push({
        category: cat.categoryName,
        currentSpending: cat.monthlyAvg,
        suggestedTarget,
        potentialSavings,
        rationale,
        priority,
      });
    }

    const estimatedMonthlySavings = recommendations.reduce((s, r) => s + r.potentialSavings, 0);

    const currentSavings = Math.round((input.totalIncome - input.totalExpense) / Math.max(input.monthsAnalyzed, 1));
    const goalMet = currentSavings >= input.savingsGoal;

    let summary: string;
    if (recommendations.length > 0 && goalMet) {
      summary = `Over the past ${input.monthsAnalyzed} month(s), you earned $${input.totalIncome.toLocaleString()} and spent $${input.totalExpense.toLocaleString()}. You're already saving ~$${currentSavings.toLocaleString()}/mo, which exceeds your $${input.savingsGoal}/mo goal. The recommendations below identify an additional $${Math.round(estimatedMonthlySavings)}/mo in potential cuts from your top categories: ${recommendations.slice(0, 3).map((r) => r.category).join(", ")}.`;
    } else if (recommendations.length > 0) {
      const gap = input.savingsGoal - currentSavings;
      summary = `Over the past ${input.monthsAnalyzed} month(s), you earned $${input.totalIncome.toLocaleString()} and spent $${input.totalExpense.toLocaleString()}. You're currently saving ~$${currentSavings.toLocaleString()}/mo — $${gap}/mo short of your $${input.savingsGoal} goal. These recommendations could close $${Math.round(estimatedMonthlySavings)}/mo of that gap from categories like ${recommendations.slice(0, 3).map((r) => r.category).join(", ")}.`;
    } else {
      summary = `Your spending patterns look healthy with a ${input.savingsRate}% savings rate. You're saving ~$${currentSavings.toLocaleString()}/mo. No major reductions recommended at this time.`;
    }

    if (recommendations.some((r) => r.category.toLowerCase().includes("food"))) {
      cautionNotes.push("Be careful not to cut food spending so aggressively that it affects nutrition or quality of meals.");
    }
    if (recommendations.some((r) => r.priority === "high" && r.potentialSavings > 100)) {
      cautionNotes.push("High-priority cuts may require lifestyle adjustments. Consider phasing in changes gradually.");
    }
    if (input.savingsRate < 10) {
      cautionNotes.push("Your current savings rate is below 10%. Building an emergency fund should be a priority.");
    }

    return { summary, recommendations, estimatedMonthlySavings, currentMonthlySavings: 0, cautionNotes };
  }

  // ──────────────────── Persistence ─────────────────────

  private async persist(userId: string, input: SavingsInput, plan: AIPlanResponse, source: string) {
    return aiRepo.create({
      userId,
      month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      inputSummary: { ...input, source } as any,
      recommendations: plan as any,
      totalSavings: plan.estimatedMonthlySavings,
      status: "GENERATED",
    });
  }
}
