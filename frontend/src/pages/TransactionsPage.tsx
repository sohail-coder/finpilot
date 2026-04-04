import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from "../hooks/useTransactions";
import { useCategories } from "../hooks/useCategories";
import { extractErrorMessage, downloadReportPdf, downloadTransactionsCsv } from "../lib/api";
import { insightState } from "../lib/insightState";
import ConfirmDialog from "../components/ConfirmDialog";
import TransactionFormModal from "../components/TransactionFormModal";
import CsvImportModal from "../components/CsvImportModal";
import type {
  Transaction,
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
} from "../types";

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 20,
  });
  const { data: txnData, isLoading, error } = useTransactions(filters);
  const { data: categories } = useCategories();
  const createMut = useCreateTransaction();
  const updateMut = useUpdateTransaction();
  const deleteMut = useDeleteTransaction();

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [formError, setFormError] = useState("");
  const queryClient = useQueryClient();

  function openCreate() {
    setEditing(null);
    setShowForm(true);
    setFormError("");
  }

  function openEdit(txn: Transaction) {
    setEditing(txn);
    setShowForm(true);
    setFormError("");
  }

  async function handleSubmit(
    data: CreateTransactionInput | UpdateTransactionInput,
  ) {
    setFormError("");
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: data });
      } else {
        await createMut.mutateAsync(data as CreateTransactionInput);
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setFormError(extractErrorMessage(err, "Failed to save transaction"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteTarget(null);
      setFormError(extractErrorMessage(err, "Failed to delete transaction"));
    }
  }

  const transactions = txnData?.data ?? [];
  const meta = txnData?.meta;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDownload(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
          >
            Download
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
          >
            Import CSV
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
          >
            + New Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Type
          </label>
          <select
            value={filters.type ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                page: 1,
                type: (e.target.value || undefined) as
                  | "INCOME"
                  | "EXPENSE"
                  | undefined,
              })
            }
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Category
          </label>
          <select
            value={filters.categoryId ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                page: 1,
                categoryId: e.target.value || undefined,
              })
            }
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            From
          </label>
          <input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                page: 1,
                startDate: e.target.value || undefined,
              })
            }
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            To
          </label>
          <input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                page: 1,
                endDate: e.target.value || undefined,
              })
            }
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <button
          onClick={() => setFilters({ page: 1, limit: 20 })}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
        >
          Clear
        </button>
      </div>

      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {formError}
          <button onClick={() => setFormError("")} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          Failed to load transactions:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500">
                    Description
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500">
                    Category
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">
                    Amount
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">
                    Base Amount
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 font-medium text-gray-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(txn.transactionDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate">
                        {txn.description || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: txn.category?.color ?? "#ccc",
                            }}
                          />
                          {txn.category?.name ?? "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                        {Number(txn.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        <span className="text-xs text-gray-400">
                          {txn.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                        {Number(txn.baseCurrencyAmount).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2 },
                        )}{" "}
                        <span className="text-xs text-gray-400">USD</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            txn.transactionType === "INCOME"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {txn.transactionType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(txn)}
                            className="text-xs text-gray-500 hover:text-indigo-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(txn)}
                            className="text-xs text-gray-500 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={meta.page <= 1}
                  onClick={() =>
                    setFilters({ ...filters, page: meta.page - 1 })
                  }
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  disabled={meta.page >= meta.totalPages}
                  onClick={() =>
                    setFilters({ ...filters, page: meta.page + 1 })
                  }
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TransactionFormModal
          categories={categories ?? []}
          initialData={editing}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          pending={createMut.isPending || updateMut.isPending}
          error={formError}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Transaction"
        message={`Delete transaction "${deleteTarget?.description || "this transaction"}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />

      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["transactions"] }); insightState.markDirty(); }}
        />
      )}

      {showDownload && (
        <DownloadModal
          onClose={() => setShowDownload(false)}
          onError={(msg) => setFormError(msg)}
        />
      )}
    </div>
  );
}

// ── Download Modal ───────────────────────────────────────

type DateRange = "currentMonth" | "custom" | "allTime";
type Format = "pdf" | "csv";

function getCurrentMonthRange(): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return [`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, "0")}`];
}

function DownloadModal({
  onClose,
  onError,
}: {
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [format, setFormat] = useState<Format>("pdf");
  const [range, setRange] = useState<DateRange>("currentMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (range === "currentMonth") {
      [startDate, endDate] = getCurrentMonthRange();
    } else if (range === "custom") {
      if (!customStart || !customEnd) {
        onError("Please select both start and end dates");
        return;
      }
      startDate = customStart;
      endDate = customEnd;
    }
    // allTime: leave both undefined (no date filter)

    setDownloading(true);
    try {
      if (format === "pdf") {
        // PDF requires dates — default to a wide range for "all time"
        const pdfStart = startDate ?? "2000-01-01";
        const pdfEnd = endDate ?? new Date().toISOString().slice(0, 10);
        await downloadReportPdf(pdfStart, pdfEnd);
      } else {
        await downloadTransactionsCsv(startDate, endDate);
      }
      onClose();
    } catch (err) {
      onError(extractErrorMessage(err, "Download failed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Download Transactions</h2>

        {/* Format */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <div className="flex gap-3">
            <button
              onClick={() => setFormat("pdf")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md border transition ${
                format === "pdf"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              PDF Report
            </button>
            <button
              onClick={() => setFormat("csv")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md border transition ${
                format === "csv"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              CSV File
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          <div className="space-y-2">
            {([
              ["currentMonth", "Current Month"],
              ["custom", "Custom Range"],
              ["allTime", "All Transactions"],
            ] as const).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="range"
                  value={value}
                  checked={range === value}
                  onChange={() => setRange(value)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom date inputs */}
        {range === "custom" && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {downloading ? "Downloading..." : `Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
