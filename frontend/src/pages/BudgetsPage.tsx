import { useState } from "react";
import { useCategories } from "../hooks/useCategories";
import {
  useBudgetStatus,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from "../hooks/useBudgets";
import { extractErrorMessage } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import type { BudgetStatus } from "../types";

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusColor(percent: number) {
  if (percent >= 100)
    return { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
  if (percent >= 80)
    return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  return {
    bar: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  };
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(getCurrentMonth);
  const { data: statuses, isLoading, error } = useBudgetStatus(month);
  const { data: categories } = useCategories();
  const createMut = useCreateBudget();
  const updateMut = useUpdateBudget();
  const deleteMut = useDeleteBudget();

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BudgetStatus | null>(null);
  const [formError, setFormError] = useState("");

  // Only show expense categories that don't already have a budget this month
  const budgetedCategoryIds = new Set(statuses?.map((s) => s.categoryId) ?? []);
  const availableCategories = categories?.filter(
    (c) =>
      c.categoryType === "EXPENSE" &&
      !c.parentId &&
      !budgetedCategoryIds.has(c.id),
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const parsed = parseFloat(amount);
    if (!categoryId || !parsed || parsed <= 0) return;
    try {
      await createMut.mutateAsync({ categoryId, amount: parsed, month });
      setCategoryId("");
      setAmount("");
    } catch (err) {
      setFormError(extractErrorMessage(err, "Failed to create budget"));
    }
  }

  function startEdit(s: BudgetStatus) {
    setEditingId(s.budgetId);
    setEditAmount(String(s.budgetAmount));
  }

  async function handleUpdate() {
    if (!editingId) return;
    const parsed = parseFloat(editAmount);
    if (!parsed || parsed <= 0) return;
    try {
      await updateMut.mutateAsync({ id: editingId, input: { amount: parsed } });
      setEditingId(null);
    } catch (err) {
      setFormError(extractErrorMessage(err, "Failed to update budget"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.budgetId);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteTarget(null);
      setFormError(extractErrorMessage(err, "Failed to delete budget"));
    }
  }

  // Totals
  const totalBudget = statuses?.reduce((s, b) => s + b.budgetAmount, 0) ?? 0;
  const totalSpent = statuses?.reduce((s, b) => s + b.spentAmount, 0) ?? 0;
  const totalRemaining = totalBudget - totalSpent;
  const overBudgetTotal =
    statuses
      ?.filter((s) => s.percentUsed >= 100)
      .reduce((sum, s) => sum + Math.abs(s.remainingAmount), 0) ?? 0;

  // Budget tips based on current data
  const topOverBudget = statuses
    ?.filter((s) => s.percentUsed >= 100)
    .sort((a, b) => b.percentUsed - a.percentUsed)[0];

  const budgetTip = topOverBudget
    ? `Your "${topOverBudget.categoryName}" budget is ${topOverBudget.percentUsed.toFixed(0)}% used. Consider reviewing your spending or adjusting the limit.`
    : "Setting budgets for all your expense categories helps you stay on track and identify savings opportunities.";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        Failed to load budgets:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  function statusLabel(percent: number) {
    if (percent >= 100) return { label: "LIMIT EXCEEDED", color: "text-red-600" };
    if (percent >= 80) return { label: "ALMOST FULL", color: "text-amber-600" };
    return { label: "ON TRACK", color: "text-emerald-600" };
  }

  const CATEGORY_ICONS: Record<string, { emoji: string; bg: string }> = {
    "food & dining": { emoji: "🍽️", bg: "bg-orange-100" },
    transportation: { emoji: "🚗", bg: "bg-blue-100" },
    housing: { emoji: "🏠", bg: "bg-violet-100" },
    utilities: { emoji: "⚡", bg: "bg-yellow-100" },
    entertainment: { emoji: "🎬", bg: "bg-pink-100" },
    healthcare: { emoji: "🏥", bg: "bg-red-100" },
    shopping: { emoji: "🛍️", bg: "bg-emerald-100" },
    education: { emoji: "📚", bg: "bg-indigo-100" },
    travel: { emoji: "✈️", bg: "bg-sky-100" },
    groceries: { emoji: "🛒", bg: "bg-green-100" },
    insurance: { emoji: "🛡️", bg: "bg-slate-100" },
  };

  function getCategoryIcon(name: string) {
    return CATEGORY_ICONS[name.toLowerCase()] ?? { emoji: "📂", bg: "bg-gray-100" };
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Budget</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">${formatCurrency(totalBudget)}</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Spent</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">${formatCurrency(totalSpent)}</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${totalRemaining >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {totalRemaining < 0 ? "-" : ""}${formatCurrency(Math.abs(totalRemaining))}
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Over Budget</p>
            <p className={`text-2xl font-bold mt-1 ${overBudgetTotal > 0 ? "text-red-600" : "text-emerald-600"}`}>
              ${formatCurrency(overBudgetTotal)}
            </p>
          </div>
          <div className={`w-11 h-11 rounded-full flex items-center justify-center ${overBudgetTotal > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          </div>
        </div>
      </div>

      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm flex items-center justify-between">
          <span>{formError}</span>
          <button onClick={() => setFormError("")} className="text-red-500 hover:text-red-700 font-medium text-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column — Create form + Tip */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Create New Budget</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select category...</option>
                  {availableCategories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Monthly Limit
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={createMut.isPending || !categoryId || !amount}
                className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {createMut.isPending ? "Adding..." : "Add Budget"}
              </button>
            </form>
          </div>

          {/* Budget Tip */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-sm font-bold text-gray-800">Budget Tip</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {budgetTip}
            </p>
          </div>
        </div>

        {/* Right column — Active Budgets */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Active Budgets</h2>
          </div>

          {!statuses?.length ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              No budgets set for this month. Create one to start tracking.
            </div>
          ) : (
            <div className="space-y-4">
              {statuses.map((s) => {
                const colors = statusColor(s.percentUsed);
                const status = statusLabel(s.percentUsed);
                const isEditing = editingId === s.budgetId;
                const catIcon = getCategoryIcon(s.categoryName);
                const isOver = s.percentUsed >= 100;

                return (
                  <div
                    key={s.budgetId}
                    className="bg-white border border-gray-200 rounded-xl p-5"
                  >
                    {/* Top row: icon + name + actions */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${catIcon.bg} flex items-center justify-center text-lg`}>
                          {catIcon.emoji}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{s.categoryName}</h3>
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(s)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit budget"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete budget"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Edit mode */}
                    {isEditing && (
                      <div className="flex items-center gap-3 mb-4 bg-gray-50 rounded-xl p-3">
                        <span className="text-sm text-gray-500">New limit:</span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={handleUpdate}
                          disabled={updateMut.isPending}
                          className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-2 text-gray-500 text-xs font-medium hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Spent vs Budget */}
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Spent vs Budget</p>
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-lg font-bold text-gray-900">
                        ${formatCurrency(s.spentAmount)} <span className="text-sm font-normal text-gray-400">of ${formatCurrency(s.budgetAmount)}</span>
                      </p>
                      <div className="text-right">
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${isOver ? "text-red-500" : "text-emerald-500"}`}>
                          {isOver ? "Over Budget" : "Remaining"}
                        </p>
                        <p className={`text-lg font-bold ${isOver ? "text-red-600" : "text-emerald-600"}`}>
                          {isOver ? "+" : ""}${formatCurrency(Math.abs(s.remainingAmount))}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${colors.bar}`}
                        style={{ width: `${Math.min(s.percentUsed, 100)}%` }}
                      />
                    </div>

                    {/* Bottom row */}
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-gray-500">
                        {s.percentUsed.toFixed(0)}% USED
                      </span>
                      <span className={`text-xs font-bold uppercase ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Budget"
        message={`Delete the budget for "${deleteTarget?.categoryName}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
