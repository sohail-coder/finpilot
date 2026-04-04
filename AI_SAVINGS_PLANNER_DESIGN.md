# AI Savings Planner — Technical Design

## Overview

The AI Savings Planner analyzes a user's spending patterns over the last 6 months,
combines deterministic statistical analysis with an LLM call, and produces
per-category savings recommendations. The result is stored in the `AIRecommendation`
table for audit trail and accept/dismiss tracking.

---

## 1. Input Contract

The route `GET /api/ai/recommendations` requires only an authenticated user
(via `req.user.userId`). No request body or query params are needed — the service
derives everything from the user's existing transaction data.

Internally, `SavingsAIService.getRecommendations()` receives a **preprocessed
input object**, never raw transactions:

```ts
interface SavingsInput {
  baseCurrency: string;                   // e.g. "USD"
  monthsAnalyzed: number;                 // always 6 (or fewer if new user)
  totalIncome: number;                    // sum of INCOME over the window
  totalExpense: number;                   // sum of EXPENSE over the window
  savingsRate: number;                    // (income − expense) / income as %

  // Per-category expense breakdown (expense categories only)
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    monthlyAverage: number;               // avg spent per month
    percentOfExpenses: number;            // share of total expense
    trend: "rising" | "stable" | "falling"; // 3-month vs prior 3-month
    month6?: number;                       // oldest month total (nullable)
    month5?: number;
    month4?: number;
    month3?: number;
    month2?: number;
    month1?: number;                       // most recent month total
  }[];

  // Budget context — which categories have budgets, are they exceeded?
  budgetContext: {
    categoryName: string;
    budgetAmount: number;
    spentThisMonth: number;
    percentUsed: number;
  }[];
}
```

**Why this shape:**
- Matches what already exists in `DashboardRepository` + `BudgetRepository`
- Category-level aggregates (not transactions) — respects the privacy rule
- `trend` gives the LLM directional context without raw month-over-month data
- `budgetContext` lets the LLM incorporate budget adherence into its advice

---

## 2. Preprocessing Logic

All preprocessing happens **before** any AI call, inside `SavingsAIService`.

### Step-by-step pipeline

```
1. Determine window
   ─ end   = last day of current month
   ─ start = 1st day of (current month − 5)  →  6-month rolling window

2. Fetch income/expense totals
   ─ Reuse DashboardRepository.getIncomeExpenseTotals(userId, start, end)
   ─ Extract totalIncome, totalExpense

3. Fetch monthly trend
   ─ Reuse DashboardRepository.getMonthlyTrend(userId, start, end)
   ─ Produces rows: { month: "YYYY-MM", transaction_type, total }

4. Fetch category breakdown
   ─ Reuse DashboardRepository.getCategoryBreakdown(userId, start, end, limit: 50)
   ─ Only EXPENSE categories returned

5. Compute per-category monthly spend from trend rows
   ─ For each expense category, pivot the trend rows into month1..month6
   ─ Calculate monthlyAverage = sum / monthsAnalyzed
   ─ Calculate percentOfExpenses = categoryTotal / totalExpense × 100
   ─ Calculate trend:
       recent3 = avg(month1, month2, month3)
       prior3  = avg(month4, month5, month6)
       if recent3 > prior3 × 1.1  → "rising"
       if recent3 < prior3 × 0.9  → "falling"
       else                        → "stable"

6. Fetch budget status
   ─ Reuse BudgetService.getStatus(userId, currentMonth)
   ─ Provides { categoryName, budgetAmount, spentAmount, percentUsed }

7. Assemble SavingsInput
   ─ Merge all above into the input object
```

### Data reuse

Every query reuses existing repositories — no new SQL, no new tables.
All amounts are `baseCurrencyAmount`, so no currency conversion at query time.

---

## 3. Aggregation Strategy

### What gets aggregated

| Dimension          | Granularity          | Source                            |
|--------------------|----------------------|-----------------------------------|
| Income / Expense   | Single total over 6mo | `getIncomeExpenseTotals`          |
| Monthly trend      | Per month, per type  | `getMonthlyTrend`                 |
| Category spend     | Per category, 6mo    | `getCategoryBreakdown(limit: 50)` |
| Budget vs actual   | Per category, current | `BudgetService.getStatus`         |

### Per-category monthly pivot

The monthly trend query returns flat rows. We pivot them into a
`Map<categoryId, Map<month, amount>>` to fill `month1..month6`.

Missing months get `0` — a user who doesn't have a transaction in a given
month/category simply has zero spend, not a null.

### Trend calculation

```
trend = compare(avg(recent 3 months), avg(prior 3 months))
  rising   → recent avg is > 10% higher
  falling  → recent avg is > 10% lower
  stable   → within ±10%
```

If the user has < 4 months of data, trend defaults to `"stable"` (insufficient
signal).

---

## 4. Prompt-Building Strategy

The LLM call uses a **structured system prompt + JSON user message** pattern.

### System prompt (static)

```
You are a personal finance advisor. You receive a structured JSON summary of a
user's spending over the past 6 months. Your task is to suggest concrete,
actionable ways to reduce spending in specific categories.

Rules:
- Only suggest savings on EXPENSE categories.
- Never recommend reducing spending on Healthcare unless it is entertainment-related.
- Be specific: "reduce Food & Dining from $450/mo to $350/mo" not "spend less on food".
- For every suggestion, provide a short rationale (1-2 sentences).
- If a category has a budget that is consistently exceeded, prioritize it.
- If a category trend is "falling", do not suggest further cuts.
- Respond ONLY with the JSON schema provided. No markdown, no extra text.
```

### User message (dynamic — populated from SavingsInput)

```json
{
  "baseCurrency": "USD",
  "monthsAnalyzed": 6,
  "totalIncome": 19200,
  "totalExpense": 15400,
  "savingsRate": 19.8,
  "categories": [
    {
      "name": "Food & Dining",
      "monthlyAvg": 482.50,
      "percentOfExpenses": 18.8,
      "trend": "rising",
      "hasBudget": true,
      "budgetAmount": 400,
      "budgetPercentUsed": 120.6
    },
    ...
  ]
}
```

### Why structured JSON input, not prose

- Deterministic parsing — no ambiguity about field names
- Token-efficient — no wasted tokens on narration
- Easier to unit test with mocked LLM responses
- Can swap between providers (OpenAI, Anthropic, local) without rewriting prompts

### Token budget

- System prompt: ~200 tokens (fixed)
- User message: ~50 tokens per category × ~15 categories = ~750 tokens
- Completion: constrained to ~800 tokens max
- **Total: ~1,750 tokens per request** — cheap enough for per-user on-demand calls

---

## 5. Output JSON Schema

The LLM must return this exact shape (enforced via JSON schema / response_format):

```ts
interface AIResponse {
  recommendations: {
    category: string;           // exact category name from input
    currentSpending: number;    // monthly average (echoed from input)
    suggestedTarget: number;    // recommended monthly spend
    potentialSavings: number;   // currentSpending − suggestedTarget
    rationale: string;          // 1-2 sentence explanation
    priority: "high" | "medium" | "low";
  }[];
  totalMonthlySavings: number;  // sum of all potentialSavings
  summary: string;              // 2-3 sentence overall assessment
}
```

### Stored in DB as:

| Column             | Value                                              |
|--------------------|----------------------------------------------------|
| `inputSummary`     | The `SavingsInput` object (JSON)                   |
| `recommendations`  | The `AIResponse` object above (JSON)               |
| `totalSavings`     | `AIResponse.totalMonthlySavings` (Decimal)         |
| `status`           | `"GENERATED"` initially                            |
| `month`            | 1st of current month                               |

### Validation before storage

Before persisting, the service validates the LLM output:
1. Parse JSON — reject if malformed
2. Check every `category` name exists in the user's actual categories
3. Check `suggestedTarget >= 0` and `potentialSavings >= 0`
4. Check `totalMonthlySavings` ≈ sum of individual `potentialSavings` (±$1 tolerance)
5. Strip any unexpected fields

If validation fails → fall back to deterministic engine (see §6).

---

## 6. Fallback Behavior if AI Fails

The system must **always return recommendations**, even if the LLM is down,
returns garbage, or the API key is missing. Three fallback tiers:

### Tier 1 — LLM call succeeds + passes validation
→ Store and return the AI response.

### Tier 2 — LLM call fails or response fails validation
→ Run the **deterministic rule engine** (pure TypeScript, no external calls):

```
For each expense category, sorted by monthlyAverage descending:

  SKIP if trend == "falling"
  SKIP if percentOfExpenses < 5%   (too small to matter)
  SKIP if category == "Healthcare" (safety)

  IF category has a budget AND percentUsed > 100%:
    suggestedTarget = budgetAmount
    rationale = "You've exceeded your ${categoryName} budget by ${overagePercent}%.
                 Bringing spending back to your budget saves $X/mo."
    priority = "high"

  ELSE IF trend == "rising":
    suggestedTarget = monthlyAverage × 0.85  (suggest 15% cut)
    rationale = "Spending on ${categoryName} has been rising. A 15% reduction
                 would save $X/mo."
    priority = "medium"

  ELSE (stable, no budget issue):
    suggestedTarget = monthlyAverage × 0.90  (suggest 10% cut)
    rationale = "A modest 10% reduction in ${categoryName} could save $X/mo."
    priority = "low"

  Cap recommendations at top 5 categories.
```

The deterministic fallback is:
- Fast (no network call)
- Predictable (unit-testable with fixed inputs)
- Always available

### Tier 3 — User has no transaction data (< 1 month)
→ Return an empty recommendations array with a message:
`"Not enough data yet. Keep tracking for at least one month to get savings insights."`

### How the caller knows which tier ran

The stored `AIRecommendation.metadata` (or a new `source` field) records:
- `"ai"` — LLM produced the result
- `"rules"` — deterministic fallback ran
- `"insufficient_data"` — not enough history

---

## 7. Why Deterministic Logic + AI Are Combined

### The problem with pure AI

| Risk                            | Mitigation via deterministic layer         |
|---------------------------------|--------------------------------------------|
| LLM hallucinates categories    | Validate category names against DB         |
| LLM suggests negative savings  | Clamp values ≥ 0 before storage            |
| LLM is down / rate-limited     | Fallback rule engine returns instant result |
| LLM output changes per call    | Rule engine is reproducible / unit-testable |
| LLM cost scales with users     | Rule engine has zero marginal cost          |
| Compliance: what data was sent? | `inputSummary` column stores exact input    |

### The problem with pure rules

| Limitation                        | What the LLM adds                           |
|-----------------------------------|----------------------------------------------|
| Rules are rigid (fixed % cuts)    | LLM adapts rationale to context              |
| Rules can't explain nuance        | LLM writes human-readable rationales         |
| Rules don't correlate categories  | LLM can say "cut Dining + Travel together"   |
| Rules can't handle edge cases     | LLM interprets unusual spending patterns     |

### The hybrid approach

```
┌─────────────────────────────────────────────────┐
│  Preprocessing (deterministic)                  │
│  ─ aggregate, compute trends, build SavingsInput│
│  ─ 100% unit-testable, no AI involved           │
└──────────────────┬──────────────────────────────┘
                   │
          SavingsInput (structured JSON)
                   │
        ┌──────────▼──────────┐
        │  LLM call (Tier 1)  │──── fails ───┐
        └──────────┬──────────┘               │
                   │                          │
          AIResponse JSON                     │
                   │                          │
        ┌──────────▼──────────┐    ┌──────────▼──────────┐
        │  Validate output    │    │  Rule engine (Tier 2)│
        │  (deterministic)    │    │  (deterministic)     │
        └──────────┬──────────┘    └──────────┬───────────┘
                   │                          │
            passes │  fails                   │
                   │    └─────────────────────>│
                   ▼                          ▼
        ┌─────────────────────────────────────┐
        │  Store in AIRecommendation table    │
        │  Return to client                   │
        └─────────────────────────────────────┘
```

**Financial calculations (totals, averages, trends, budget comparisons) are always
deterministic.** The LLM only adds natural-language rationale and contextual
prioritization on top of data that has already been validated and aggregated.

This means:
- A bug in the LLM never corrupts financial data
- The system degrades gracefully (AI → rules → empty state)
- Every recommendation can be traced back to the exact input that produced it
- The preprocessing + validation layers can be tested without mocking an LLM

---

## API Surface (unchanged from existing routes)

| Method | Path                       | Purpose                          |
|--------|----------------------------|----------------------------------|
| GET    | `/api/ai/recommendations`  | Trigger analysis, return results |
| GET    | `/api/ai/history`          | Past recommendations             |
| PATCH  | `/api/ai/:id/status`       | Accept or dismiss                |

No new endpoints needed — the existing skeleton in `ai.ts` already defines them.

---

## Implementation Checklist (for next step)

1. Add an `AIRecommendationRepository` (if not already complete) with `create`,
   `findByUserId`, `updateStatus`
2. Add a per-category monthly query to `DashboardRepository` (pivot by categoryId + month)
3. Build the preprocessing pipeline in `SavingsAIService`
4. Build the deterministic rule engine as a pure function
5. Add the LLM integration (OpenAI `chat.completions` with `response_format: json`)
6. Add output validation layer
7. Wire into the existing route (replace the `[]` placeholder)
8. Build the frontend page with recommendation cards + accept/dismiss actions
