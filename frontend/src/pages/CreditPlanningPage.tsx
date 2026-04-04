import { useState } from "react";

/* ── Mock data ─────────────────────────────────────────── */
const MOCK_SCORE = {
  score: 720,
  maxScore: 850,
  status: "GOOD STANDING",
  change: +12,
  changePeriod: "last 30 days",
};

const MOCK_METRICS = {
  debtToIncome: 24,
  creditAge: 6.2,
  creditAgePercentile: 68,
};

const MOCK_ALERT =
  "Lowering your utilization below 15% could trigger a 25-point surge next month.";

const MOCK_OBJECTIVES = [
  {
    icon: "home",
    title: "Buy a Home",
    subtitle: "Primary Residence Fund",
    targetRate: "6.2% APR",
    targetScore: 760,
    pointsAway: 40,
    pointsLabel: "Critical threshold",
    pointsColor: "text-red-500",
    progress: 82,
    progressColor: "bg-indigo-600",
    footerText: 'Best rates require "Excellent" status',
  },
  {
    icon: "car",
    title: "Buy a Car",
    subtitle: "SUV / Family Vehicle",
    targetRate: "4.5% APR",
    targetScore: 740,
    pointsAway: 20,
    pointsLabel: "Optimal status near",
    pointsColor: "text-emerald-600",
    progress: 84,
    progressColor: "bg-emerald-500",
    footerText: "Negotiation power: High",
  },
];

const MOCK_ACTIONS = [
  {
    icon: "card",
    title: "Pay down Sapphire Card balance",
    description: "Recommended reduction: $500.00",
    impact: "+15 pts",
  },
  {
    icon: "alert",
    title: "Dispute Merchant Error",
    description: "Unrecognized charge from Oct 12 on Equifax",
    impact: "+22 pts",
  },
];

const MOCK_TIMELINE = [
  { phase: 1, label: "Phase 1: Recovery", detail: "Reach 740 in 45 days" },
  { phase: 2, label: "Phase 2: Target Goal", detail: "Reach 760 in 4 months" },
];

const MOCK_AFFORDABILITY =
  "Hitting 760 reduces your monthly mortgage estimate by $240/mo, increasing your total borrowing power by $42,000.";

/* ── Helpers ──────────────────────────────────────────── */
function scoreArc(score: number, max: number) {
  const pct = score / max;
  const r = 80;
  const c = 2 * Math.PI * r;
  return { circumference: c, offset: c * (1 - pct) };
}

/* ── Component ────────────────────────────────────────── */
export default function CreditPlanningPage() {
  const [toast, setToast] = useState(false);

  function handleFetchScore() {
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  const { circumference, offset } = scoreArc(MOCK_SCORE.score, MOCK_SCORE.maxScore);

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.981-1.742 2.981H4.42c-1.53 0-2.493-1.647-1.743-2.981l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Feature coming soon!
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Credit Planning</h1>
        <button
          onClick={handleFetchScore}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Fetch Credit Score
        </button>
      </div>

      {/* ── Top Section: Score + Metrics ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Credit Score Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Your Credit Standing</p>

          {/* Circular gauge */}
          <div className="relative w-48 h-48 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#6366f1"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-extrabold text-gray-900">{MOCK_SCORE.score}</span>
              <span className="text-sm text-gray-400 font-medium">/ {MOCK_SCORE.maxScore}</span>
              <span className="mt-2 px-3 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                {MOCK_SCORE.status}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-500 text-center">
            Your score has increased by{" "}
            <span className="font-bold text-emerald-600">+{MOCK_SCORE.change} points</span> in the {MOCK_SCORE.changePeriod}.
          </p>
        </div>

        {/* Metrics + Alert */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-6">
            {/* Debt-to-Income */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-500">Debt-to-Income</span>
              </div>
              <p className="text-4xl font-extrabold text-gray-900 mb-3">{MOCK_METRICS.debtToIncome}%</p>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${MOCK_METRICS.debtToIncome}%` }} />
              </div>
            </div>

            {/* Credit Age */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-500">Credit Age</span>
              </div>
              <p className="text-4xl font-extrabold text-gray-900 mb-1">{MOCK_METRICS.creditAge} Years</p>
              <p className="text-xs text-gray-400 font-medium">Stronger than {MOCK_METRICS.creditAgePercentile}% of users</p>
            </div>
          </div>

          {/* Intelligence Alert */}
          <div className="bg-emerald-600 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider mb-1">Intelligence Alert</p>
              <p className="text-sm text-white font-medium leading-relaxed">{MOCK_ALERT}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Purchase Objectives ────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">Purchase Objectives</h2>
          <button onClick={handleFetchScore} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
            Adjust Parameters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MOCK_OBJECTIVES.map((obj) => (
            <div key={obj.title} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                    {obj.icon === "home" ? (
                      <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{obj.title}</h3>
                    <p className="text-xs text-gray-400">{obj.subtitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target Rate</p>
                  <p className="text-lg font-extrabold text-gray-900">{obj.targetRate}</p>
                </div>
              </div>

              {/* Score + Points away */}
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Target Credit Score</p>
                  <p className="text-3xl font-extrabold text-gray-900">{obj.targetScore}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${obj.pointsColor}`}>{obj.pointsAway} points away</p>
                  <p className="text-[10px] text-gray-400">{obj.pointsLabel}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Progress to Eligibility</p>
                  <p className="text-sm font-bold text-gray-700">{obj.progress}%</p>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${obj.progressColor}`} style={{ width: `${obj.progress}%` }} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
                <p className="text-xs text-gray-500 font-medium">{obj.footerText}</p>
                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Planner Intelligence ───────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">AI Planner Intelligence</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recommended Actions */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Recommended Actions</p>
            <div className="space-y-4">
              {MOCK_ACTIONS.map((action) => (
                <div
                  key={action.title}
                  className="flex items-center gap-4 bg-gray-50 rounded-xl p-4 border border-gray-100"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    {action.icon === "card" ? (
                      <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{action.title}</p>
                    <p className="text-xs text-gray-400">{action.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold text-emerald-600">{action.impact}</p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider">Est. Impact</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline + Affordability */}
          <div className="space-y-6">
            {/* Optimization Timeline */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Optimization Timeline</p>
              <div className="space-y-4">
                {MOCK_TIMELINE.map((t) => (
                  <div key={t.phase} className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-white">{t.phase}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-400">{t.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Goal Affordability Impact */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Goal Affordability Impact</p>
              <p className="text-sm text-gray-700 leading-relaxed">{MOCK_AFFORDABILITY}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
