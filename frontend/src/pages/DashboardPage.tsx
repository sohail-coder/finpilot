import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import type { DashboardSummary, Transaction } from "../types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ── Date helpers ─────────────────────────────────────────

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

type Preset = "thisMonth" | "last3" | "last6" | "ytd" | "custom";

function getPresetRange(preset: Exclude<Preset, "custom">): [string, string] {
  const today = new Date();
  switch (preset) {
    case "thisMonth":
      return [toISODate(startOfMonth(today)), toISODate(endOfMonth(today))];
    case "last3": {
      const d = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      return [toISODate(d), toISODate(endOfMonth(today))];
    }
    case "last6": {
      const d = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return [toISODate(d), toISODate(endOfMonth(today))];
    }
    case "ytd":
      return [toISODate(new Date(today.getFullYear(), 0, 1)), toISODate(endOfMonth(today))];
  }
}

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Component ────────────────────────────────────────────

const PRESETS: { key: Exclude<Preset, "custom">; label: string }[] = [
  { key: "thisMonth", label: "This Month" },
  { key: "last3", label: "Last 3 Mo" },
  { key: "last6", label: "Last 6 Mo" },
  { key: "ytd", label: "YTD" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [startDate, endDate] = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) return [customStart, customEnd];
    if (preset !== "custom") return getPresetRange(preset);
    return ["", ""];
  }, [preset, customStart, customEnd]);

  // Previous month range (for comparison, only when thisMonth is selected)
  const [prevStart, prevEnd] = useMemo(() => {
    if (preset !== "thisMonth") return ["", ""];
    const today = new Date();
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return [toISODate(prev), toISODate(endOfMonth(prev))];
  }, [preset]);

  const { data, isLoading, error } = useDashboard(startDate, endDate);
  const { data: prevData } = useDashboard(prevStart, prevEnd);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-medium mb-1">Financial Intelligence Dashboard</p>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Overview</h1>
        </div>
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                preset === p.key
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setPreset("custom")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              preset === "custom"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-3 mb-8">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          Failed to load dashboard: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {data && <DashboardContent data={data} prevData={preset === "thisMonth" ? prevData : undefined} onViewAllTransactions={() => navigate("/transactions")} onAddTransaction={() => navigate("/transactions", { state: { openAdd: true } })} />}

      {/* Floating Add Transaction Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => navigate("/transactions", { state: { openAdd: true } })}
          className="flex items-center gap-2 px-5 py-3.5 bg-indigo-600 text-white rounded-full shadow-[0_12px_28px_-6px_rgba(99,102,241,0.45)] hover:bg-indigo-700 transition-all active:scale-95 font-bold text-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Transaction
        </button>
      </div>
    </div>
  );
}

function DashboardContent({ data, prevData, onViewAllTransactions }: { data: DashboardSummary; prevData?: DashboardSummary; onViewAllTransactions: () => void; onAddTransaction: () => void }) {
  const savingsRate = data.totalIncome > 0 ? Math.round((data.netSavings / data.totalIncome) * 100) : 0;
  const prevSavingsRate = prevData && prevData.totalIncome > 0 ? Math.round((prevData.netSavings / prevData.totalIncome) * 100) : undefined;

  // Compute % change vs previous month
  const incomeChange = prevData && prevData.totalIncome > 0
    ? Math.round(((data.totalIncome - prevData.totalIncome) / prevData.totalIncome) * 100)
    : undefined;
  const expenseChange = prevData && prevData.totalExpense > 0
    ? Math.round(((data.totalExpense - prevData.totalExpense) / prevData.totalExpense) * 100)
    : undefined;
  const savingsRateChange = prevSavingsRate !== undefined
    ? savingsRate - prevSavingsRate
    : undefined;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* ── Income vs Expenses Chart (full width) ── */}
      <div className="col-span-12">
        <MonthlyTrendChart trend={data.monthlyTrend} />
      </div>

      {/* ── Highlight Cards ── */}
      <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <HighlightCard
          label="Monthly Income"
          value={`$${formatCurrency(data.totalIncome)}`}
          trend={incomeChange !== undefined ? { pct: incomeChange, positive: incomeChange >= 0 } : undefined}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <HighlightCard
          label="Monthly Expenses"
          value={`$${formatCurrency(data.totalExpense)}`}
          trend={expenseChange !== undefined ? { pct: expenseChange, positive: expenseChange <= 0 } : undefined}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          }
        />
        <HighlightCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          subtitle={savingsRate >= 50 ? "Excellent" : savingsRate >= 20 ? "Good" : savingsRate >= 0 ? "Needs work" : "Negative"}
          trend={savingsRateChange !== undefined ? { pct: savingsRateChange, positive: savingsRateChange >= 0, suffix: "pts" } : undefined}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      </div>

      {/* ── Spending by Category + Recent Transactions ── */}
      <div className="col-span-12 lg:col-span-5">
        <CategoryBreakdown categories={data.topCategories} totalExpense={data.totalExpense} />
      </div>
      <div className="col-span-12 lg:col-span-7">
        <RecentTransactions transactions={data.recentTransactions} onViewAll={onViewAllTransactions} />
      </div>
    </div>
  );
}

// ── Highlight Card ───────────────────────────────────────

function HighlightCard({
  label,
  value,
  subtitle,
  trend,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  subtitle?: string;
  trend?: { pct: number; positive: boolean; suffix?: string };
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-gray-400 font-semibold mb-2">{label}</p>
        <div className="flex items-end gap-3">
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <span className="text-sm text-gray-400 pb-0.5 font-medium">{subtitle}</span>}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${trend.positive ? "text-emerald-600" : "text-red-600"}`}>
            <span>{trend.pct >= 0 ? "↑" : "↓"}</span>
            <span>{Math.abs(trend.pct)}{trend.suffix ? ` ${trend.suffix}` : "%"} vs last mo</span>
          </div>
        )}
      </div>
      <div className={`w-14 h-14 rounded-full ${iconBg} flex items-center justify-center ${iconColor}`}>
        <span className="[&>svg]:w-6 [&>svg]:h-6">{icon}</span>
      </div>
    </div>
  );
}

// ── Monthly Trend (Grouped Bar chart) ────────────────────

function MonthlyTrendChart({ trend }: { trend: DashboardSummary["monthlyTrend"] }) {
  const chartData = trend.map((t) => {
    const label = t.month.slice(0, 7); // "YYYY-MM"
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIdx = parseInt(label.split("-")[1]!, 10) - 1;
    return {
      month: monthNames[monthIdx] ?? label,
      Income: Math.round(t.income),
      Expense: Math.round(t.expense),
    };
  });

  return (
    <div className="bg-[#f2f4f6] rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Income vs Expenses</h3>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-gray-500">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs font-medium text-gray-500">Expenses</span>
          </div>
        </div>
      </div>
      {trend.length === 0 ? (
        <p className="text-sm text-gray-400">No data for this period.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  fontSize: "13px",
                }}
                formatter={(value) => [`$${Number(value).toLocaleString()}`]}
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
              />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Expense" fill="#991b1b" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Category Breakdown ───────────────────────────────────

const CATEGORY_COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#9ca3af", "#f59e0b", "#ec4899"];

function CategoryBreakdown({
  categories,
  totalExpense,
}: {
  categories: DashboardSummary["topCategories"];
  totalExpense: number;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-6 h-full">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Spending by Category</h3>
      {categories.length === 0 ? (
        <p className="text-sm text-gray-400">No expenses in this period.</p>
      ) : (
        <div className="space-y-5">
          {categories.map((c, i) => {
            const pct = totalExpense > 0 ? (c.total / totalExpense) * 100 : 0;
            const barColor = c.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <div key={c.categoryId} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                    <span className="font-semibold text-gray-800">{c.categoryName}</span>
                  </div>
                  <span className="font-bold text-gray-900">
                    ${formatCurrency(c.total)}{" "}
                    <span className="text-gray-400 font-normal ml-1">{pct.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Recent Transactions ──────────────────────────────────

function RecentTransactions({ transactions, onViewAll }: { transactions: Transaction[]; onViewAll: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between px-6 py-5">
        <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
        <button onClick={onViewAll} className="text-indigo-600 text-sm font-bold hover:underline">
          View All
        </button>
      </div>
      {transactions.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-gray-400">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-t border-b border-gray-100">
                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.1em] text-gray-400 font-medium">Description</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.1em] text-gray-400 font-medium">Date</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.1em] text-gray-400 font-medium">Category</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-[0.1em] text-gray-400 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map((tx) => {
                const isIncome = tx.transactionType === "INCOME";
                return (
                  <tr key={tx.id} className="group hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{tx.description || "—"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                      {new Date(tx.transactionDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tx.category.color }} />
                        <span className="text-sm text-gray-500">{tx.category.name}</span>
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right text-sm font-bold ${isIncome ? "text-emerald-600" : "text-red-500"}`}>
                      {isIncome ? "+" : "-"}${formatCurrency(Number(tx.baseCurrencyAmount))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
