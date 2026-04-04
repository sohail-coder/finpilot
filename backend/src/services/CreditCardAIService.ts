import { DashboardRepository, TransactionRepository } from "../repositories";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// ── Types ────────────────────────────────────────────────

export interface CreditCardRecommendation {
  cardName: string;
  issuer: string;
  imageUrl: string;
  applyUrl: string;
  annualFee: string;
  rewardsRate: string;
  signUpBonus: string;
  bestFor: string;
  matchScore: number; // 0–100
  rationale: string;
}

export interface CreditCardInsight {
  title: string;
  description: string;
  integrationHealth: number; // 0–100
  cards: CreditCardRecommendation[];
}

// ── Repos ────────────────────────────────────────────────

const dashboardRepo = new DashboardRepository();
const txnRepo = new TransactionRepository();

// ── Service ──────────────────────────────────────────────

export class CreditCardAIService {
  async recommend(userId: string): Promise<CreditCardInsight> {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [categoryRows, totals] = await Promise.all([
      dashboardRepo.getCategoryBreakdown(userId, sixMonthsAgo, now, 20),
      dashboardRepo.getIncomeExpenseTotals(userId, sixMonthsAgo, now),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    for (const row of totals) {
      const amount = Number(row._sum.baseCurrencyAmount ?? 0);
      if (row.transactionType === "INCOME") totalIncome = amount;
      else totalExpense = Math.abs(amount);
    }

    const categories = categoryRows.map((c) => ({
      name: c.category_name,
      total: c.total,
      percent: totalExpense > 0 ? ((c.total / totalExpense) * 100).toFixed(1) : "0",
    }));

    if (categories.length === 0) {
      return {
        title: "Not Enough Data",
        description: "Add more transactions to receive personalized credit card recommendations.",
        integrationHealth: 0,
        cards: [],
      };
    }

    if (env.OPENAI_API_KEY) {
      try {
        return await this.callLLM(categories, totalIncome, totalExpense);
      } catch (err) {
        logger.warn("Credit card LLM call failed, using fallback", err);
      }
    }

    return this.fallback(categories, totalIncome, totalExpense);
  }

  // ── OpenAI Call ──────────────────────────────────────────

  private async callLLM(
    categories: { name: string; total: number; percent: string }[],
    totalIncome: number,
    totalExpense: number,
  ): Promise<CreditCardInsight> {
    const systemPrompt = `You are a personal finance credit card advisor. Based on the user's spending breakdown, recommend 2-3 real, well-known credit cards that maximize their rewards.

Rules:
- Only recommend REAL credit cards that exist (e.g. Chase Sapphire Preferred, Amex Blue Cash Preferred, Citi Double Cash, Capital One SavorOne, etc.)
- Match cards to the user's top spending categories.
- Provide realistic annual fees, rewards rates, and sign-up bonuses.
- For imageUrl, provide a short descriptive placeholder like "chase-sapphire-preferred" (the frontend will handle rendering).
- For applyUrl, provide the real official application URL of the card issuer.
- matchScore should be 0-100 based on how well the card fits the user's spending pattern.
- The "description" field is CRITICAL: it must be a personalized 3-4 sentence insight that references the user's ACTUAL spending amounts and categories. For example: "Over the last 6 months you spent $X on Food & Dining and $Y on Transport, making up Z% of your total expenses. Cards with elevated cashback in these categories could save you $W annually." Do NOT use generic text. Use the exact dollar amounts from the input data.
- Respond ONLY with valid JSON matching the schema below. No markdown, no extra text.

Required JSON schema:
{
  "title": "short 2-4 word insight title",
  "description": "2-3 sentence analysis of spending and why these cards are recommended",
  "integrationHealth": <number 70-100>,
  "cards": [
    {
      "cardName": "exact card name",
      "issuer": "issuer name",
      "imageUrl": "card-slug-identifier",
      "applyUrl": "https://real-application-url",
      "annualFee": "$XX/year or $0",
      "rewardsRate": "X% on category, Y% on everything else",
      "signUpBonus": "description of sign up bonus",
      "bestFor": "1-3 word category like Dining, Travel, Groceries",
      "matchScore": <0-100>,
      "rationale": "1-2 sentence explanation of why this card fits"
    }
  ]
}`;

    const userMessage = JSON.stringify({
      totalIncome,
      totalExpense,
      spendingCategories: categories,
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
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const parsed = JSON.parse(content) as CreditCardInsight;

    // Validate structure
    if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      throw new Error("Invalid card recommendations structure");
    }

    return parsed;
  }

  // ── Fallback ─────────────────────────────────────────────

  private fallback(
    categories: { name: string; total: number; percent: string }[],
    totalIncome: number,
    totalExpense: number,
  ): CreditCardInsight {
    const topCategory = categories[0]?.name?.toLowerCase() ?? "";

    const cards: CreditCardRecommendation[] = [];

    if (["food", "dining", "restaurants", "groceries"].some((k) => topCategory.includes(k))) {
      cards.push({
        cardName: "Amex Blue Cash Preferred",
        issuer: "American Express",
        imageUrl: "amex-blue-cash-preferred",
        applyUrl: "https://www.americanexpress.com/us/credit-cards/card/blue-cash-preferred/",
        annualFee: "$95/year",
        rewardsRate: "6% on groceries, 6% on streaming, 3% on transit, 1% on other",
        signUpBonus: "$350 back after spending $3,000 in first 6 months",
        bestFor: "Groceries & Dining",
        matchScore: 92,
        rationale: `Your top spending category is ${categories[0]?.name}. This card maximizes grocery cashback at 6%.`,
      });
    }

    if (["transport", "travel", "gas", "fuel", "uber", "lyft"].some((k) => topCategory.includes(k))) {
      cards.push({
        cardName: "Chase Sapphire Preferred",
        issuer: "Chase",
        imageUrl: "chase-sapphire-preferred",
        applyUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
        annualFee: "$95/year",
        rewardsRate: "5x on travel via Chase, 3x on dining, 2x on other travel, 1x on everything else",
        signUpBonus: "60,000 points after spending $4,000 in first 3 months",
        bestFor: "Travel & Transport",
        matchScore: 90,
        rationale: `Heavy spending on ${categories[0]?.name} makes this card ideal for maximizing travel rewards.`,
      });
    }

    // Always include a general cashback card
    cards.push({
      cardName: "Citi Double Cash Card",
      issuer: "Citibank",
      imageUrl: "citi-double-cash",
      applyUrl: "https://www.citi.com/credit-cards/citi-double-cash-credit-card",
      annualFee: "$0",
      rewardsRate: "2% on everything — 1% when you buy, 1% when you pay",
      signUpBonus: "$200 back after spending $1,500 in first 6 months",
      bestFor: "Everyday Spending",
      matchScore: 85,
      rationale: "A no-annual-fee card with flat 2% cashback on all purchases — ideal as a default card.",
    });

    if (cards.length < 3) {
      cards.push({
        cardName: "Capital One SavorOne",
        issuer: "Capital One",
        imageUrl: "capital-one-savorone",
        applyUrl: "https://www.capitalone.com/credit-cards/savorone-dining-rewards/",
        annualFee: "$0",
        rewardsRate: "3% on dining, entertainment, groceries & streaming, 1% on everything",
        signUpBonus: "$200 back after spending $500 in first 3 months",
        bestFor: "Dining & Entertainment",
        matchScore: 82,
        rationale: "Great all-around card with no annual fee and 3% on dining and entertainment.",
      });
    }

    const topCats = categories.slice(0, 3).map((c) => c.name).join(", ");
    const topAmounts = categories.slice(0, 3).map((c) => `$${c.total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} on ${c.name}`).join(", ");
    const topPercent = categories.slice(0, 3).reduce((sum, c) => sum + parseFloat(c.percent), 0).toFixed(0);

    return {
      title: "Smart Card Match",
      description: `Over the past 6 months you spent ${topAmounts}, accounting for ${topPercent}% of your $${totalExpense.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total expenses. These cards are selected to maximize cashback and rewards on your highest spending categories.`,
      integrationHealth: 95,
      cards: cards.slice(0, 3),
    };
  }
}
