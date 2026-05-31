import http from "k6/http";
import { check, sleep } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.3/index.js";

// ──────────────────────────────────────────────────────
// FinPilot Smoke Test — quick sanity check (30s)
// ──────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "https://d12soe1wpe4cpt.cloudfront.net";

export const options = {
  vus: 3,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.20"],
  },
};

export default function () {
  // Public endpoints only — no auth needed
  const checks = {
    "google-client-id": http.get(`${BASE_URL}/api/auth/google-client-id`),
    "auth-me": http.get(`${BASE_URL}/api/auth/me`),
  };

  check(checks["google-client-id"], {
    "google-client-id status 200": (r) => r.status === 200,
  });

  check(checks["auth-me"], {
    "auth/me returns 200": (r) => r.status === 200,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: "  ", enableColors: true }),
  };
}
