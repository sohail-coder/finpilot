import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ──────────────────────────────────────────────────────
// FinPilot Stress Test
// ──────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "https://d12soe1wpe4cpt.cloudfront.net";

// Custom metrics
const errorRate = new Rate("errors");
const loginDuration = new Trend("login_duration", true);
const dashboardDuration = new Trend("dashboard_duration", true);
const transactionsDuration = new Trend("transactions_duration", true);
const categoriesDuration = new Trend("categories_duration", true);
const budgetsDuration = new Trend("budgets_duration", true);
const apiCalls = new Counter("api_calls");

// ── Test Stages ──────────────────────────────────────
// Ramp-up → sustained load → spike → cool down
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up (normal traffic)
    ramping_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },   // warm up
        { duration: "1m", target: 25 },     // normal load
        { duration: "30s", target: 50 },    // ramp to peak
        { duration: "1m", target: 50 },     // sustained peak
        { duration: "30s", target: 100 },   // spike!
        { duration: "30s", target: 100 },   // hold spike
        { duration: "30s", target: 25 },    // cool down
        { duration: "30s", target: 0 },     // drain
      ],
      gracefulRampDown: "10s",
    },

    // Scenario 2: Constant arrival rate (API bombardment)
    constant_api_rate: {
      executor: "constant-arrival-rate",
      rate: 30,                // 30 requests per second
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 50,
      maxVUs: 100,
      startTime: "1m",        // start after warmup
      exec: "apiBarrage",
    },

    // Scenario 3: Health check pings (monitoring simulation)
    health_checks: {
      executor: "constant-vus",
      vus: 2,
      duration: "5m",
      exec: "healthCheck",
    },
  },

  thresholds: {
    http_req_duration: ["p(95)<3000", "p(99)<5000"],   // 95% under 3s, 99% under 5s
    http_req_failed: ["rate<0.10"],                     // <10% failures
    errors: ["rate<0.15"],                              // custom error rate
    login_duration: ["p(95)<4000"],
    dashboard_duration: ["p(95)<3000"],
    transactions_duration: ["p(95)<2000"],
  },
};

// ── Test credentials ─────────────────────────────────
const TEST_USER = {
  email: `stresstest_${__VU}@finpilot-test.com`,
  password: "StressTest123!",
  name: `Stress Tester ${__VU}`,
};

// ── Helper: parse cookies from jar ───────────────────
function getAuthHeaders(jar) {
  return {
    headers: {
      "Content-Type": "application/json",
    },
    jar: jar,
  };
}

// ── Helper: register or login ────────────────────────
function authenticate(jar) {
  // Try login first
  const loginStart = Date.now();
  let res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
    { headers: { "Content-Type": "application/json" }, jar: jar }
  );

  if (res.status === 200) {
    loginDuration.add(Date.now() - loginStart);
    return true;
  }

  // If login fails, register
  res = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: TEST_USER.name,
    }),
    { headers: { "Content-Type": "application/json" }, jar: jar }
  );

  loginDuration.add(Date.now() - loginStart);

  return check(res, {
    "auth succeeded": (r) => r.status === 200 || r.status === 201,
  });
}

// ── Default scenario: Full user journey ──────────────
export default function () {
  const jar = http.cookieJar();

  // 1. Authenticate
  group("Authentication", () => {
    const ok = authenticate(jar);
    errorRate.add(!ok);
    apiCalls.add(1);
  });

  sleep(0.5);

  // 2. Check profile
  group("Profile Check", () => {
    const res = http.get(`${BASE_URL}/api/auth/me`, { jar: jar });
    const ok = check(res, {
      "profile loaded": (r) => r.status === 200,
    });
    errorRate.add(!ok);
    apiCalls.add(1);
  });

  sleep(0.3);

  // 3. Load categories
  let categoryId = null;
  group("Categories", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/categories`, { jar: jar });
    categoriesDuration.add(Date.now() - start);
    const ok = check(res, {
      "categories loaded": (r) => r.status === 200,
    });
    errorRate.add(!ok);
    apiCalls.add(1);

    try {
      const body = JSON.parse(res.body);
      if (body.data && body.data.length > 0) {
        categoryId = body.data[0].id;
      }
    } catch (e) {}
  });

  sleep(0.3);

  // 4. Load dashboard
  group("Dashboard", () => {
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/dashboard?startDate=${startDate}&endDate=${endDate}`,
      { jar: jar }
    );
    dashboardDuration.add(Date.now() - start);
    const ok = check(res, {
      "dashboard loaded": (r) => r.status === 200,
    });
    errorRate.add(!ok);
    apiCalls.add(1);
  });

  sleep(0.5);

  // 5. Create a transaction
  let txnId = null;
  group("Create Transaction", () => {
    const payload = {
      type: Math.random() > 0.5 ? "INCOME" : "EXPENSE",
      amount: Math.round(Math.random() * 500 * 100) / 100,
      description: `Stress test txn ${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
    };
    if (categoryId) payload.categoryId = categoryId;

    const res = http.post(
      `${BASE_URL}/api/transactions`,
      JSON.stringify(payload),
      { headers: { "Content-Type": "application/json" }, jar: jar }
    );
    const ok = check(res, {
      "transaction created": (r) => r.status === 201 || r.status === 200,
    });
    errorRate.add(!ok);
    apiCalls.add(1);

    try {
      const body = JSON.parse(res.body);
      if (body.data && body.data.id) txnId = body.data.id;
    } catch (e) {}
  });

  sleep(0.3);

  // 6. List transactions (paginated)
  group("List Transactions", () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/transactions?page=1&limit=20`,
      { jar: jar }
    );
    transactionsDuration.add(Date.now() - start);
    const ok = check(res, {
      "transactions listed": (r) => r.status === 200,
    });
    errorRate.add(!ok);
    apiCalls.add(1);
  });

  sleep(0.3);

  // 7. Load budgets
  group("Budgets", () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/budgets?month=${month}`, { jar: jar });
    budgetsDuration.add(Date.now() - start);
    const ok = check(res, {
      "budgets loaded": (r) => r.status === 200,
    });
    errorRate.add(!ok);
    apiCalls.add(1);
  });

  sleep(0.3);

  // 8. Budget status check
  group("Budget Status", () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const res = http.get(`${BASE_URL}/api/budgets/status?month=${month}`, { jar: jar });
    const ok = check(res, {
      "budget status loaded": (r) => r.status === 200,
    });
    errorRate.add(!ok);
    apiCalls.add(1);
  });

  sleep(0.3);

  // 9. Update transaction (if created)
  if (txnId) {
    group("Update Transaction", () => {
      const res = http.patch(
        `${BASE_URL}/api/transactions/${txnId}`,
        JSON.stringify({ description: `Updated stress test ${Date.now()}` }),
        { headers: { "Content-Type": "application/json" }, jar: jar }
      );
      const ok = check(res, {
        "transaction updated": (r) => r.status === 200,
      });
      errorRate.add(!ok);
      apiCalls.add(1);
    });

    sleep(0.2);

    // 10. Delete transaction (cleanup)
    group("Delete Transaction", () => {
      const res = http.del(`${BASE_URL}/api/transactions/${txnId}`, null, { jar: jar });
      const ok = check(res, {
        "transaction deleted": (r) => r.status === 200 || r.status === 204,
      });
      errorRate.add(!ok);
      apiCalls.add(1);
    });
  }

  sleep(1);
}

// ── Scenario: API Barrage (constant rate) ────────────
export function apiBarrage() {
  const jar = http.cookieJar();
  authenticate(jar);

  // Rapid-fire read-heavy requests
  const endpoints = [
    "/api/auth/me",
    "/api/categories",
    "/api/transactions?page=1&limit=10",
    `/api/dashboard?startDate=2026-01-01&endDate=2026-04-30`,
    "/api/auth/google-client-id",
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { jar: jar });

  check(res, {
    "barrage request ok": (r) => r.status === 200,
  });
  errorRate.add(res.status !== 200);
  apiCalls.add(1);
}

// ── Scenario: Health Check ───────────────────────────
export function healthCheck() {
  const res = http.get(`${BASE_URL}/api/auth/google-client-id`);
  check(res, {
    "health ok": (r) => r.status === 200,
  });
  apiCalls.add(1);
  sleep(5);
}

// ── Summary handler ──────────────────────────────────
export function handleSummary(data) {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    stdout: textSummary(data, { indent: "  ", enableColors: true }),
    [`tests/stress/results-${now}.json`]: JSON.stringify(data, null, 2),
  };
}

import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.3/index.js";
