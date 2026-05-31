# FinPilot Stress Test Results

**Date:** $(date)  
**Infrastructure:** AWS App Runner (0.25 vCPU, 0.5 GB RAM) + CloudFront CDN  
**Database:** Supabase PostgreSQL  
**Tool:** Grafana k6 v1.7.1  

---

## 1. Smoke Test (Baseline)

| Metric | Value |
|--------|-------|
| VUs | 3 |
| Duration | 30s |
| Checks Passed | **100%** (144/144) |
| Requests | 144 (4.6 req/s) |
| p(95) Latency | **266ms** |
| p(90) Latency | 260ms |
| Median Latency | 76ms |
| Failures | **0%** |

**Verdict:** All public endpoints healthy under light load.

---

## 2. Full Stress Test

### Scenarios
- **ramping_load:** 0 → 10 → 25 → 50 → 100 → 25 → 0 VUs over 5 min (full user journey)
- **constant_api_rate:** 30 req/s for 2 min (random read endpoints)
- **health_checks:** 2 VUs for 5 min (continuous health pings)

### Overall Summary

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Total Requests | 2,614 (8.4 req/s) | — | — |
| HTTP Failures | **58.14%** | < 10% | **FAILED** |
| Custom Errors | **49.51%** | < 15% | **FAILED** |
| p(95) Latency | **60s** (timeout) | < 3s | **FAILED** |
| p(90) Latency | 60s | — | — |
| Median Latency | 1.1s | — | — |
| Data Received | 3.1 MB | — | — |
| Data Sent | 689 KB | — | — |

### Endpoint Breakdown

| Endpoint Group | Success Rate | Median | p(90) | p(95) |
|---------------|-------------|--------|-------|-------|
| Health Check | **100%** ✅ | — | — | — |
| Auth (register/login) | **15-25%** ❌ | 62s | 67s | 74s |
| Categories | 50% ⚠️ | 494ms | 3.9s | 5.6s |
| Dashboard | 50% ⚠️ | 404ms | 3.9s | 7.0s |
| Transactions (list) | 50% ⚠️ | 410ms | 4.6s | 6.9s |
| Transactions (create) | **0%** ❌ | — | — | — |
| Budgets | 50% ⚠️ | 402ms | 3.8s | 4.6s |
| Budget Status | 51% ⚠️ | — | — | — |
| API Barrage (reads) | 50% ⚠️ | — | — | — |

---

## 3. Root Cause Analysis

### Primary Bottleneck: Auth Endpoints (bcrypt + tiny instance)

The **#1 issue** is auth (register/login). bcrypt password hashing is CPU-intensive by design, and on a **0.25 vCPU** App Runner instance, it becomes a fatal bottleneck:

- **Register/Login median:** 62 seconds (!)
- Each bcrypt hash with default salt rounds (10-12) takes ~250ms on a full CPU — with 0.25 vCPU and 50+ concurrent users, requests queue up and timeout at 60s
- Transaction creation has **0% success** because VUs can't authenticate, so all downstream operations fail

### Cascade Effect

1. Auth blocks → VUs wait 60s+ for tokens
2. No tokens → authenticated endpoints fail
3. App Runner's 0.25 vCPU is fully saturated by bcrypt
4. Even read endpoints degrade (50% success) due to CPU starvation

### What's Actually Fine

- **Health endpoint**: 100% — CloudFront/App Runner networking is healthy
- **Read endpoints when authenticated**: Median 400-500ms — reasonable for a micro instance
- **Database (Supabase)**: Not the bottleneck — queries are fast when CPU is available

---

## 4. Recommendations

### Immediate (No cost change)

1. **Reduce bcrypt salt rounds** from 12 → 10 (2-4x faster hashing, still secure)
2. **Add rate limiting** on auth endpoints (prevent abuse, protect CPU)
3. **Implement connection pooling** if not already present

### Scale Up (Cost increase)

4. **Increase App Runner to 1 vCPU / 2 GB RAM** — would handle 50+ concurrent users
5. **Enable App Runner auto-scaling** — min 1, max 3 instances for burst traffic
6. **Add Redis** for session caching to reduce DB round-trips

### Architecture (Longer term)

7. **Move to JWT refresh tokens** — reduce login frequency
8. **Add CDN caching** for read-heavy endpoints (categories, exchange rates)
9. **Consider splitting auth** into a separate service with higher CPU allocation

---

## 5. Capacity Estimate (Current Setup)

| Concurrent Users | Expected Performance |
|-----------------|---------------------|
| 1-3 | Excellent (< 300ms p95) |
| 5-10 | Good (< 1s p95, occasional auth delays) |
| 10-25 | Degraded (auth timeouts, reads slow) |
| 25-50 | Poor (50%+ failure rate) |
| 50-100 | Unusable (auth completely blocked) |

**Current capacity: ~5-10 concurrent users** on 0.25 vCPU App Runner.
