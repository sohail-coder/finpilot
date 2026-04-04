import { useState, useCallback, useEffect } from "react";
import { downloadReportPdf, extractErrorMessage, fetchReportSchedule, upsertReportSchedule, deleteReportSchedule } from "../lib/api";
import { useDashboard } from "../hooks/useDashboard";
import { useAuth } from "../hooks/useAuth";
import type { ReportSchedule } from "../types";

function defaultStartDate() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate() {
  return new Date().toISOString().slice(0, 10);
}

interface ReportRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  generatedAt: Date;
  status: "Verified" | "Archived";
}

type Preset = "thisMonth" | "last3" | "last6" | "custom";

export default function ReportsPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<Preset>("thisMonth");
  const [reports, setReports] = useState<ReportRecord[]>([]);

  // Auto-schedule state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Load schedule on mount
  useEffect(() => {
    fetchReportSchedule()
      .then((s) => setSchedule(s))
      .catch(() => {});
  }, []);

  // Dashboard data for Smart Summary
  const { data: dashData } = useDashboard(startDate, endDate);

  const handlePreset = (preset: Preset, months: number) => {
    setActivePreset(preset);
    if (preset === "custom") return;
    const end = new Date();
    const start = new Date();
    if (months === 0) {
      start.setDate(1);
    } else {
      start.setMonth(start.getMonth() - months);
      start.setDate(1);
    }
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  const handleDownload = async () => {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }
    if (startDate > endDate) {
      setError("Start date must be before end date.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await downloadReportPdf(startDate, endDate);
      // Add to recent reports
      const now = new Date();
      const reportName = `FinPilot_Report_${startDate}_to_${endDate}.pdf`;
      setReports((prev) => [
        {
          id: crypto.randomUUID(),
          name: reportName,
          startDate,
          endDate,
          generatedAt: now,
          status: "Verified",
        },
        ...prev,
      ]);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to generate report."));
    } finally {
      setLoading(false);
    }
  };

  const handleRedownload = useCallback(async (report: ReportRecord) => {
    try {
      await downloadReportPdf(report.startDate, report.endDate);
    } catch {
      // silently fail re-download
    }
  }, []);

  const handleDeleteReport = (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }) + " • " + d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Compute smart summary
  const totalIncome = dashData?.totalIncome ?? 0;
  const totalExpense = dashData?.totalExpense ?? 0;
  const incomeVsExpenseChange = totalIncome > 0
    ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1)
    : "0.0";
  const topCategory = dashData?.topCategories
    ?.sort((a, b) => b.total - a.total)[0];

  const presets = [
    { key: "thisMonth" as Preset, label: "This Month", months: 0 },
    { key: "last3" as Preset, label: "Last 3 Months", months: 3 },
    { key: "last6" as Preset, label: "Last 6 Months", months: 6 },
    { key: "custom" as Preset, label: "Custom Range", months: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-400 mt-1">Deep dive into your financial health</p>
      </div>

      {/* Top section: Generate + Smart Summary / Auto-Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Generate New Report */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Generate New Report</h2>
          </div>

          {/* Time Period */}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Time Period</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePreset(p.key, p.months)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activePreset === p.key
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}

          {/* Intelligence Hint + Download */}
          <div className="flex items-start gap-4">
            <div className="flex-1 bg-indigo-50 rounded-xl p-4">
              <p className="text-xs font-bold text-indigo-600 mb-1">Intelligence Hint:</p>
              <p className="text-xs text-indigo-500 leading-relaxed">
                {activePreset === "last3"
                  ? 'Generating a report for "Last 3 Months" will automatically include a multi-period comparison and trend analysis.'
                  : activePreset === "last6"
                  ? 'Generating a report for "Last 6 Months" provides a comprehensive half-year overview with spending trends.'
                  : "Your report will include income & expense totals, category breakdowns, and a complete transaction listing."}
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right column: Smart Summary + Auto-Schedule */}
        <div className="lg:col-span-5 space-y-5">
          {/* Smart Summary */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">Smart Summary</span>
            </div>
            <p className="text-xs text-indigo-200 mb-1">Income vs Expense Change</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-3xl font-bold">
                {Number(incomeVsExpenseChange) >= 0 ? "+" : ""}{incomeVsExpenseChange}%
              </span>
              <svg className="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-xs text-indigo-200 mb-1">Top Spending Category</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{topCategory?.categoryName ?? "N/A"}</span>
              {topCategory && (
                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded uppercase">
                  {((topCategory.total / totalExpense) * 100).toFixed(0)}% of spend
                </span>
              )}
            </div>
          </div>

          {/* Auto-Schedule */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <div className="flex justify-center mb-3">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Auto-Schedule</h3>
            {schedule?.active ? (
              <>
                <p className="text-sm text-gray-400 leading-relaxed mb-1">
                  Monthly report sent to
                </p>
                <p className="text-sm font-medium text-gray-700 mb-1">{schedule.email}</p>
                <p className="text-xs text-gray-400 mb-4">
                  1st of every month
                  {schedule.lastSent && ` · Last sent ${new Date(schedule.lastSent).toLocaleDateString()}`}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setScheduleEmail(schedule.email);
                      setScheduleError(null);
                      setShowScheduleModal(true);
                    }}
                    className="text-indigo-600 text-sm font-semibold hover:text-indigo-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      await deleteReportSchedule();
                      setSchedule(null);
                    }}
                    className="text-red-500 text-sm font-semibold hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  Get monthly reports delivered directly to your inbox on the 1st.
                </p>
                <button
                  onClick={() => {
                    setScheduleEmail(schedule?.email ?? user?.email ?? "");
                    setScheduleError(null);
                    setShowScheduleModal(true);
                  }}
                  className="text-indigo-600 text-sm font-semibold hover:text-indigo-700 transition-colors"
                >
                  Setup Automation
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Auto-Schedule Report</h3>
            <p className="text-sm text-gray-500 mb-5">
              A PDF report for the previous month will be emailed on the 1st of every month.
            </p>

            {scheduleError && (
              <p className="text-sm text-red-600 mb-3">{scheduleError}</p>
            )}

            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={scheduleEmail}
              onChange={(e) => setScheduleEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none mb-5"
            />

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={scheduleSaving}
                onClick={async () => {
                  if (!scheduleEmail.trim()) {
                    setScheduleError("Email is required.");
                    return;
                  }
                  setScheduleError(null);
                  setScheduleSaving(true);
                  try {
                    const s = await upsertReportSchedule(scheduleEmail.trim());
                    setSchedule(s);
                    setShowScheduleModal(false);
                  } catch (err) {
                    setScheduleError(extractErrorMessage(err));
                  } finally {
                    setScheduleSaving(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {scheduleSaving ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Reports */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Reports</h2>
        </div>

        {reports.length === 0 ? (
          <div className="px-6 pb-8 text-center text-gray-400 text-sm py-10">
            <svg className="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            No reports generated yet. Create your first report above.
          </div>
        ) : (
          <div className="px-6 pb-5">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider pb-3 border-b border-gray-100">
              <div className="col-span-5">Report Name</div>
              <div className="col-span-3">Date Generated</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Table rows */}
            {reports.map((report) => (
              <div
                key={report.id}
                className="grid grid-cols-12 gap-4 items-center py-4 border-b border-gray-50 last:border-0 group"
              >
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-800 truncate">{report.name}</span>
                </div>
                <div className="col-span-3 text-sm text-gray-500">
                  {formatDate(report.generatedAt)}
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    report.status === "Verified"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      report.status === "Verified" ? "bg-emerald-500" : "bg-gray-400"
                    }`} />
                    {report.status}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleRedownload(report)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Download report"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete report"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
