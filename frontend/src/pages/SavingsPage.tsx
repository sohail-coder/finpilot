import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { generateSavingsPlan, fetchSavingsHistory, updateSavingsPlanStatus, deleteSavingsPlan, fetchCreditCardRecommendations, extractErrorMessage } from "../lib/api";
import { insightState } from "../lib/insightState";
import type { SavingsPlan, SavingsPlanHistory, CreditCardRecommendation } from "../types";

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SavingsPage() {
  const [savingsGoal, setSavingsGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [plan, setPlan] = useState<SavingsPlan | null>(null);
  const [history, setHistory] = useState<SavingsPlanHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: cardInsight, isFetching: cardsFetching, refetch: refetchCards } = useQuery({
    queryKey: ["creditCardRecommendations"],
    queryFn: fetchCreditCardRecommendations,
    enabled: false,
    staleTime: Infinity,
  });

  // Auto-refetch when transactions have changed since last fetch
  useEffect(() => {
    if (insightState.isDirty()) {
      insightState.clear();
      refetchCards();
    }
  }, [refetchCards]);

  const handleRefreshCards = useCallback(() => {
    refetchCards();
  }, [refetchCards]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const goal = parseFloat(savingsGoal);
    if (!goal || goal <= 0) {
      setError("Please enter a valid savings goal");
      return;
    }
    setLoading(true);
    setError("");
    setPlan(null);
    try {
      const result = await generateSavingsPlan(
        goal,
        startDate || undefined,
        endDate || undefined,
      );
      setPlan(result);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadHistory() {
    setHistoryLoading(true);
    try {
      const data = await fetchSavingsHistory();
      setHistory(data);
      setShowHistory(true);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleViewPastPlan(h: SavingsPlanHistory) {
    const stored = h.recommendations as Record<string, unknown>;
    const input = h.inputSummary as Record<string, unknown>;
    const recs = Array.isArray(stored.recommendations) ? stored.recommendations : [];
    setPlan({
      id: h.id,
      summary: (stored.summary as string) ?? "",
      recommendations: recs.map((r: Record<string, unknown>) => ({
        category: String(r.category ?? ""),
        currentSpending: Number(r.currentSpending ?? 0),
        suggestedTarget: Number(r.suggestedTarget ?? 0),
        potentialSavings: Number(r.potentialSavings ?? 0),
        rationale: String(r.rationale ?? ""),
        priority: (["high", "medium", "low"].includes(String(r.priority)) ? String(r.priority) : "medium") as "high" | "medium" | "low",
      })),
      estimatedMonthlySavings: Number(stored.estimatedMonthlySavings ?? 0),
      currentMonthlySavings: Number(stored.currentMonthlySavings ?? 0),
      cautionNotes: Array.isArray(stored.cautionNotes) ? (stored.cautionNotes as string[]) : [],
      source: (["ai", "rules", "insufficient_data"].includes(String(input.source)) ? String(input.source) : "rules") as "ai" | "rules" | "insufficient_data",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleStatusUpdate(id: string, status: "ACCEPTED" | "DISMISSED") {
    try {
      await updateSavingsPlanStatus(id, status);
      if (plan && plan.id === id) {
        setPlan(null);
      }
      if (showHistory) {
        setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, status } : h)));
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSavingsPlan(id);
      if (plan && plan.id === id) {
        setPlan(null);
      }
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">AI Savings Planner</h1>
        <button
          onClick={handleLoadHistory}
          disabled={historyLoading}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          {historyLoading ? "Loading..." : "View History"}
        </button>
      </div>

      {/* ── Input Form ──────────────────────── */}
      <form
        onSubmit={handleGenerate}
        className="bg-white rounded-lg border border-gray-200 p-5 mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Generate Savings Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Monthly Savings Goal ($) *
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={savingsGoal}
              onChange={(e) => setSavingsGoal(e.target.value)}
              placeholder="e.g. 500"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Start Date (optional)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              End Date (optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? "Analyzing..." : "Generate Plan"}
          </button>
          <span className="text-xs text-gray-400">
            Defaults to last 6 months if dates are omitted
          </span>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">
          {error}
        </div>
      )}

      {/* ── Plan Results ────────────────────── */}
      {plan && (
        <div className="space-y-5">
          {/* Source badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                plan.source === "ai"
                  ? "bg-purple-100 text-purple-700"
                  : plan.source === "rules"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {plan.source === "ai" ? "AI-Powered" : plan.source === "rules" ? "Rule-Based" : "Insufficient Data"}
            </span>
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{plan.summary}</p>
          </div>

          {/* Savings overview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <span className="text-sm font-medium text-gray-500">Current Monthly Savings</span>
              <p className="text-2xl font-bold text-indigo-700 mt-2">${fmt(plan.currentMonthlySavings)}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <span className="text-sm font-medium text-emerald-600">Additional Savings Opportunity</span>
              <p className="text-2xl font-bold text-emerald-700 mt-2">${fmt(plan.estimatedMonthlySavings)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <span className="text-sm font-medium text-gray-500">Potential Total Savings</span>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${fmt(plan.currentMonthlySavings + plan.estimatedMonthlySavings)}/mo
              </p>
            </div>
          </div>

          {/* Recommendations */}
          {plan.recommendations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-base font-semibold text-gray-700 mb-4">Recommendations</h3>
              <div className="space-y-4">
                {plan.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className={`border rounded-xl p-5 ${PRIORITY_COLORS[rec.priority]}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-base">{rec.category}</span>
                      <span className="text-sm font-bold uppercase">{rec.priority}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                      <div>
                        <span className="opacity-70">Current:</span>{" "}
                        <span className="font-bold">${fmt(rec.currentSpending)}/mo</span>
                      </div>
                      <div>
                        <span className="opacity-70">Target:</span>{" "}
                        <span className="font-bold">${fmt(rec.suggestedTarget)}/mo</span>
                      </div>
                      <div>
                        <span className="opacity-70">Save:</span>{" "}
                        <span className="font-bold">${fmt(rec.potentialSavings)}/mo</span>
                      </div>
                    </div>
                    <p className="text-sm opacity-80 leading-relaxed">{rec.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Caution Notes */}
          {plan.cautionNotes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">Caution Notes</h3>
              <ul className="list-disc list-inside space-y-1">
                {plan.cautionNotes.map((note, i) => (
                  <li key={i} className="text-sm text-amber-700">{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => handleStatusUpdate(plan.id, "ACCEPTED")}
              className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition"
            >
              Accept Plan
            </button>
            <button
              onClick={() => handleStatusUpdate(plan.id, "DISMISSED")}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── History ─────────────────────────── */}
      {showHistory && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Past Plans</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Hide
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400">No past plans found.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Month</th>
                    <th className="text-right px-4 py-2">Est. Savings</th>
                    <th className="text-center px-4 py-2">Status</th>
                    <th className="text-center px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => handleViewPastPlan(h)}
                      className={`cursor-pointer transition ${
                        plan?.id === h.id
                          ? "bg-indigo-50 hover:bg-indigo-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-2">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">
                        {new Date(h.month).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        ${h.totalSavings ? fmt(Number(h.totalSavings)) : "0.00"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            h.status === "ACCEPTED"
                              ? "bg-emerald-100 text-emerald-700"
                              : h.status === "DISMISSED"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewPastPlan(h); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            View
                          </button>
                          {h.status === "GENERATED" && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(h.id, "ACCEPTED"); }}
                                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(h.id, "DISMISSED"); }}
                                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(h.id); }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Credit Card Recommendations ─────── */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* AI Insight Card — fixed size */}
          <div className="bg-indigo-100 rounded-2xl p-6 h-80">
            {cardsFetching ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-10 h-10 border-[3px] border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
                <p className="text-xs font-medium text-indigo-600">Analyzing spending patterns…</p>
              </div>
            ) : !cardInsight ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-indigo-200 flex items-center justify-center">
                  <span className="text-2xl">✦</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-900 mb-1">AI Credit Card Insights</p>
                  <p className="text-xs text-indigo-700 leading-relaxed">Click the button below to analyze your spending and get personalized credit card recommendations.</p>
                </div>
                <button
                  onClick={handleRefreshCards}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Get Recommendations
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✦</span>
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">AI Insight</span>
                  </div>
                  <button
                    onClick={handleRefreshCards}
                    disabled={cardsFetching}
                    className="p-1.5 rounded-lg hover:bg-indigo-200 transition-colors text-indigo-600"
                    title="Refresh insights"
                  >
                    <svg className={`w-4 h-4 ${cardsFetching ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <h3 className="text-xl font-bold text-indigo-900 mb-3">
                  {cardInsight?.title ?? "Smart Card Match"}
                </h3>
                <p className="text-sm text-indigo-800 leading-relaxed">
                  {cardInsight?.description ?? "Analyzing your spending patterns to find the best credit cards for you..."}
                </p>
              </>
            )}
          </div>

          {/* Credit Card Recommendations */}
          <div className="lg:col-span-2">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recommended Credit Cards</h2>
              {cardInsight && (
                <button
                  onClick={handleRefreshCards}
                  disabled={cardsFetching}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-50"
                >
                  <svg className={`w-3.5 h-3.5 ${cardsFetching ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              )}
            </div>

            {cardsFetching ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-[3px] border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Fetching personalized recommendations…</p>
              </div>
            ) : !cardInsight?.cards?.length ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">
                {cardInsight ? (
                  <p>Not enough transaction data yet. Add transactions to get personalized card recommendations.</p>
                ) : (
                  <p>Click <strong>Get Recommendations</strong> to analyze your spending and discover the best credit cards for you.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {cardInsight.cards.map((card, i) => (
                  <CreditCardRow key={i} card={card} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card color map based on issuer ───────────────────────
const ISSUER_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  chase: { bg: "from-blue-900 to-blue-700", accent: "bg-blue-500", text: "text-white" },
  "american express": { bg: "from-sky-800 to-sky-600", accent: "bg-sky-400", text: "text-white" },
  amex: { bg: "from-sky-800 to-sky-600", accent: "bg-sky-400", text: "text-white" },
  citibank: { bg: "from-blue-600 to-cyan-500", accent: "bg-cyan-400", text: "text-white" },
  citi: { bg: "from-blue-600 to-cyan-500", accent: "bg-cyan-400", text: "text-white" },
  "capital one": { bg: "from-red-700 to-red-500", accent: "bg-red-400", text: "text-white" },
  discover: { bg: "from-orange-600 to-amber-500", accent: "bg-amber-400", text: "text-white" },
  default: { bg: "from-indigo-700 to-purple-600", accent: "bg-purple-400", text: "text-white" },
};

function getIssuerColor(issuer: string) {
  const key = issuer.toLowerCase();
  return Object.entries(ISSUER_COLORS).find(([k]) => key.includes(k))?.[1] ?? ISSUER_COLORS.default;
}

function CreditCardRow({ card, rank }: { card: CreditCardRecommendation; rank: number }) {
  const colors = getIssuerColor(card.issuer);
  if (!colors) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-5">
        {/* Card Visual */}
        <div className={`w-32 h-20 bg-gradient-to-br ${colors.bg} rounded-xl flex-shrink-0 relative overflow-hidden shadow-lg`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-2 right-3 w-8 h-8 border-2 border-white/40 rounded-full" />
            <div className="absolute top-2 right-6 w-8 h-8 border-2 border-white/30 rounded-full" />
          </div>
          <div className="absolute bottom-2 left-3">
            <p className="text-[8px] text-white/60 uppercase tracking-wider">{card.issuer}</p>
            <p className="text-[10px] text-white font-bold leading-tight">{card.cardName.split(" ").slice(-2).join(" ")}</p>
          </div>
          <div className="absolute top-2 left-3">
            <div className="w-6 h-4 bg-yellow-300/80 rounded-sm" />
          </div>
        </div>

        {/* Card Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">{card.cardName}</h3>
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded uppercase">
                  #{rank} Match
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{card.issuer} · {card.annualFee}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-700">{card.matchScore}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{card.rationale}</p>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" />
              </svg>
              <span className="text-xs text-gray-600">{card.rewardsRate}</span>
            </div>
            {card.signUpBonus && (
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-gray-600">{card.signUpBonus}</span>
              </div>
            )}
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
              Best for {card.bestFor}
            </span>
          </div>

          <div className="mt-3">
            <a
              href={card.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Apply Now
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
