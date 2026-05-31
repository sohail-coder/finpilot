<p align="center">
  <img src="https://img.shields.io/badge/FinPilot-Personal%20Finance-0d9488?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJ2MjAiLz48cGF0aCBkPSJNMTcgNUg5LjVhMy41IDMuNSAwIDAgMCAwIDdoNWEzLjUgMy41IDAgMCAxIDAgN0g2Ii8+PC9zdmc+" alt="FinPilot"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Build-Passing-brightgreen?style=flat-square" alt="Build"/>
  <img src="https://img.shields.io/badge/Deploy-AWS-FF9900?style=flat-square&logo=amazonaws" alt="AWS"/>
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License"/>
</p>

<h1 align="center">FinPilot</h1>
<p align="center"><strong>AI-powered personal finance management platform</strong></p>
<p align="center">Track expenses, manage budgets, sync bank accounts, get AI savings recommendations — all in one app.</p>

---

## Project Stats

<table>
<tr>
<td>

### Codebase

| Metric | Value |
|--------|------:|
| Total Lines of Code | **9,721** |
| Backend (TypeScript) | 4,300 |
| Frontend (React/TSX) | 5,421 |
| Source Files | **84** |
| Prisma Models | **9** |

</td>
<td>

### Architecture

| Component | Count |
|-----------|------:|
| API Routes | **9** |
| Services | **11** |
| Repositories | **10** |
| React Pages | **9** |
| Components & Hooks | **9** |

</td>
</tr>
</table>

### API Endpoints — 39 Total

| Domain | Endpoints | Auth Required |
|--------|:---------:|:------------:|
| Auth (register, login, Google OAuth, logout, me) | 6 | No |
| Transactions (CRUD, CSV import, bulk delete) | 7 | Yes |
| Categories (CRUD, reassignment) | 5 | Yes |
| Budgets (CRUD, status tracking) | 5 | Yes |
| Dashboard (summary, trends, charts) | 4 | Yes |
| Reports (monthly, PDF export) | 4 | Yes |
| Bank Sync (connect, sync, status, logs) | 4 | Yes |
| AI (savings analysis, credit recommendations, credit planning) | 4 | Yes |

### Load Test Results (k6)

| Scenario | VUs | Duration | p95 Latency | Success Rate |
|----------|:---:|:--------:|:-----------:|:------------:|
| Smoke Test | 3 | 30s | **266ms** | **100%** |
| Ramp to 100 VUs | 100 | 5 min | 60s* | 47% |
| Constant 30 rps | 100 | 2 min | 60s* | 50% |

> *\*Timeouts caused by bcrypt CPU saturation on 0.25 vCPU App Runner instance. Read endpoints are ~400ms median when CPU is available. See [detailed results](tests/stress/RESULTS.md).*

### CI/CD Pipeline

| Stage | Tool | Status |
|-------|------|:------:|
| Lint & Type Check | GitHub Actions | ✅ |
| Backend Tests | Jest + Coverage | ✅ |
| Frontend Build | Vite | ✅ |
| Code Quality | SonarCloud | ✅ |
| Deploy Backend | AWS App Runner | ✅ |
| Deploy Frontend | S3 + CloudFront | ✅ |

---

## Tech Stack

<table>
<tr><td><b>Layer</b></td><td><b>Technology</b></td></tr>
<tr><td>Frontend</td><td>React 18, Vite 6, TypeScript 5.8, TailwindCSS 3, React Query 5, Recharts 3</td></tr>
<tr><td>Backend</td><td>Express 4, TypeScript, Prisma 6 ORM, Node.js 20</td></tr>
<tr><td>Database</td><td>PostgreSQL (Supabase)</td></tr>
<tr><td>Auth</td><td>JWT (httpOnly cookies) + Google OAuth 2.0</td></tr>
<tr><td>AI</td><td>OpenAI GPT-4o-mini (savings analysis, credit recommendations)</td></tr>
<tr><td>Cloud</td><td>AWS App Runner, S3, CloudFront, ECR, Secrets Manager</td></tr>
<tr><td>CI/CD</td><td>GitHub Actions (OIDC auth, no static keys) + SonarCloud</td></tr>
<tr><td>Load Testing</td><td>Grafana k6</td></tr>
</table>

---

## Features

- **Dashboard** — Financial overview with spending trends, category breakdowns, and interactive charts
- **Transactions** — Full CRUD with CSV import, bulk operations, filtering, and pagination
- **Budgets** — Category-based budget tracking with real-time status and alerts
- **Categories** — Custom categories with safe reassignment and deletion
- **Bank Sync** — Simulated bank connection with transaction syncing
- **Reports** — Monthly/yearly reports with PDF export
- **AI Savings Planner** — GPT-powered spending analysis with actionable savings recommendations
- **Credit Card Recommendations** — AI-matched credit card suggestions based on spending patterns
- **Credit Planning** — Personalized credit score improvement roadmap
- **Multi-Currency** — Exchange rate support for international transactions
- **Google OAuth** — One-click sign-in alongside email/password auth

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database (or Supabase)
- OpenAI API key (for AI features)

### Backend

```bash
cd backend
npm install
cp .env.example .env          # configure DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
npx prisma migrate deploy
npx prisma generate
npm run dev                    # http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

### Deploy to AWS

```bash
./deploy-aws.sh               # one-click deploy: ECR → App Runner + S3 → CloudFront
```

---

## Project Structure

```
finpilot/
├── backend/
│   ├── prisma/                # Schema, migrations, seed
│   ├── src/
│   │   ├── api/
│   │   │   ├── middleware/     # Auth, validation, error handling, logging
│   │   │   └── routes/        # 9 route modules (39 endpoints)
│   │   ├── config/            # Env, database, constants
│   │   ├── providers/         # Bank sync, exchange rate providers
│   │   ├── repositories/      # 10 data access repositories
│   │   ├── services/          # 11 business logic services
│   │   ├── types/             # TypeScript types & error classes
│   │   └── utils/             # JWT, bcrypt, CSV parser, PDF generator
│   └── tests/                 # Unit & integration tests
├── frontend/
│   └── src/
│       ├── components/        # Shared UI components
│       ├── hooks/             # 5 custom React hooks
│       ├── lib/               # API client (Axios)
│       └── pages/             # 9 pages
├── tests/stress/              # k6 load test scripts & results
├── .github/workflows/         # CI + CD pipelines
└── deploy-aws.sh              # One-click AWS deployment
```

---

## License

MIT
