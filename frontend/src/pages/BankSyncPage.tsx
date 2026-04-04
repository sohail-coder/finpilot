import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  triggerBankSync,
  fetchSyncHistory,
  purgeSyncedTransactions,
  extractErrorMessage,
} from "../lib/api";
import type { BankSyncResult } from "../types";

const PAGE_SIZE = 4;

export default function BankSyncPage() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [purging, setPurging] = useState(false);
  const [result, setResult] = useState<BankSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["syncHistory"],
    queryFn: fetchSyncHistory,
  });

  const handleSync = async () => {
    setError(null);
    setResult(null);
    setSyncing(true);
    try {
      const res = await triggerBankSync("mock");
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ["syncHistory"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch (err) {
      setError(extractErrorMessage(err, "Bank sync failed."));
    } finally {
      setSyncing(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm("Delete all bank-synced transactions and sync history?")) return;
    setError(null);
    setPurging(true);
    try {
      const res = await purgeSyncedTransactions();
      setResult(null);
      queryClient.invalidateQueries({ queryKey: ["syncHistory"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      alert(`Deleted ${res.deleted} synced transactions.`);
    } catch (err) {
      setError(extractErrorMessage(err, "Purge failed."));
    } finally {
      setPurging(false);
    }
  };

  // Pagination
  const totalPages = Math.ceil(history.length / PAGE_SIZE);
  const paginatedHistory = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats
  const totalTransactions = history.reduce((sum, log) => sum + log.transactionCount, 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Sync</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your financial pipelines and ensure your transaction data is curated with up-to-the-minute precision.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePurge}
            disabled={syncing || purging}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {purging ? "Purging…" : "Purge All"}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || purging}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {syncing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium text-sm">Dismiss</button>
        </div>
      )}

      {/* Provider Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white flex-shrink-0">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-gray-900">Mock Bank Provider</h2>
              <span className="text-[10px] font-bold bg-indigo-600 text-white px-2.5 py-0.5 rounded uppercase tracking-wider">Demo Mode</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              Import sample transactions from a simulated bank connection. This demonstrates the sync pipeline that would connect to Plaid or another real provider.
            </p>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Fully Isolated
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                256-bit Encrypted
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Result */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">Sync Result</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
              <p className="text-xs font-medium text-emerald-600 mt-1">Imported</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">Duplicates</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{result.failed}</p>
              <p className="text-xs font-medium text-red-600 mt-1">Failed</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 rounded-xl p-4 max-h-40 overflow-y-auto">
              {result.errors.map((e, i) => (
                <div key={i} className="flex gap-2 text-sm py-1.5 border-b border-red-100 last:border-0">
                  <span className="text-gray-700 font-medium">{e.description}</span>
                  <span className="text-red-600">{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync History */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-gray-900">Sync History</h2>
            <span className="text-xs text-gray-400 font-medium">Last 30 Days</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Filter">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Export">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>

        {historyLoading ? (
          <div className="px-6 pb-8 flex justify-center">
            <div className="animate-spin h-6 w-6 border-3 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : history.length === 0 ? (
          <div className="px-6 pb-8 text-center text-gray-400 text-sm py-10">
            <svg className="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            No sync attempts yet. Click "Sync Now" to get started.
          </div>
        ) : (
          <div className="px-6 pb-5">
            {/* Table header */}
            <div className="grid grid-cols-11 gap-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider pb-3 border-b border-gray-100">
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Transactions</div>
              <div className="col-span-3">Error</div>
            </div>

            {/* Table rows */}
            {paginatedHistory.map((log) => {
              const { date, time } = formatDate(log.createdAt);
              const isSuccess = log.status === "SUCCESS";
              const isFailed = log.status === "FAILURE";
              return (
                <div key={log.id} className="grid grid-cols-11 gap-4 items-center py-4 border-b border-gray-50 last:border-0">
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-800">{date}</p>
                    <p className="text-xs text-gray-400">{time}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded uppercase tracking-wider">
                      {log.source}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isSuccess ? "bg-emerald-500" : isFailed ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className={`text-sm font-medium ${isSuccess ? "text-emerald-600" : isFailed ? "text-red-600" : "text-amber-600"}`}>
                        {isSuccess ? "Success" : isFailed ? "Failed" : log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-semibold text-gray-800">{log.transactionCount}</span>
                  </div>
                  <div className="col-span-3">
                    {log.errorMessage ? (
                      <span className="text-sm text-red-500 leading-snug">{log.errorMessage}</span>
                    ) : (
                      <span className="text-sm text-gray-300">—</span>
                    )}
                  </div>

                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-gray-400">
                  Showing {paginatedHistory.length} of {history.length} sync operations
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next Page
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacer for sticky bar */}
      <div className="h-20" />

      {/* Bottom Stats Bar — sticky */}
      <div className="fixed bottom-0 left-72 right-0 bg-white border-t border-gray-200 px-8 py-4 flex items-center gap-8 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Volume</p>
            <p className="text-lg font-bold text-gray-900">
              {totalTransactions >= 1000 ? `${(totalTransactions / 1000).toFixed(1)}k` : totalTransactions} Trans.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Success Rate</p>
            <p className="text-lg font-bold text-gray-900">
              {history.length > 0
                ? `${((history.filter((l) => l.status === "SUCCESS").length / history.length) * 100).toFixed(0)}%`
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
