# Backend Modules Guide

A quick reference for every folder and module in the FinPilot backend, organized by architectural layer.

---

## Top-Level

| Path | Purpose |
|------|---------|
| `prisma/` | Contains the Prisma ORM schema that defines all 7 database entities and their relationships. Acts as the single source of truth for the database structure. |
| `src/` | All application source code, organized by architectural layer. |

---

## `src/config/`

| Module | Purpose |
|--------|---------|
| `env.ts` | Validates all environment variables at startup using Zod — if anything is missing or malformed, the app exits immediately with a clear error. |
| `database.ts` | Creates a singleton Prisma client and exposes `connectDatabase()` / `disconnectDatabase()` for lifecycle management. |
| `constants.ts` | Defines app-wide constants like supported currencies, default categories, pagination limits, and budget alert thresholds. |

---

## `src/types/`

| Module | Purpose |
|--------|---------|
| `errors.ts` | Custom error class hierarchy (`AppError` → `ValidationError`, `NotFoundError`, `AuthError`, `ForbiddenError`, `ConflictError`) so every thrown error carries a proper HTTP status code. |
| `models.ts` | TypeScript interfaces mirroring each Prisma entity for use in service/repository signatures without coupling to Prisma types directly. |
| `api.ts` | Shared request/response shapes — pagination, filters, dashboard summary, budget status, and AI recommendation structures used across routes and services. |

---

## `src/utils/`

| Module | Purpose |
|--------|---------|
| `logger.ts` | Winston logger singleton — outputs colorized text in development, structured JSON in production. Used by every layer for consistent logging. |
| `jwt.ts` | Signs and verifies JWT access/refresh tokens using the app's secret. Encapsulates all token logic in one place. |
| `password.ts` | Wraps bcrypt for hashing and comparing passwords with a fixed salt round of 12. |
| `validation.ts` | All Zod schemas (register, login, create/update transaction, category, budget, pagination, filters) — the single source of truth for input validation rules. |
| `currencyConverter.ts` | Converts transaction amounts to the user's base currency using exchange rates stored in the database. |
| `csvParser.ts` | Streams a CSV buffer through `csv-parser`, validates each row with Zod, and returns valid rows plus per-row errors. |
| `pdfGenerator.ts` | Generates a PDF buffer from structured report data using PDFKit — title, summary, and tabular rows. |

---

## `src/api/middleware/`

| Module | Purpose |
|--------|---------|
| `auth.ts` | Extracts JWT from httpOnly cookie or Authorization header, verifies it, and attaches `req.user` for downstream handlers. |
| `validate.ts` | Factory middleware that takes any Zod schema and a target (`body` / `query` / `params`), validates the request, and replaces raw data with the parsed (coerced) result. |
| `errorHandler.ts` | Global Express error handler — maps `AppError` subclasses to proper HTTP responses and logs unexpected errors. Must be registered last. |
| `requestLogger.ts` | Logs every HTTP request's method, URL, status code, and duration using Winston at the `http` level. |

---

## `src/repositories/`

| Module | Purpose |
|--------|---------|
| `BaseRepository.ts` | Abstract class that provides the Prisma client (`this.db`) to all child repositories — ensures a single point of database access. |
| `UserRepository.ts` | CRUD operations for users including soft-delete support (`deletedAt` filtering). |
| `TransactionRepository.ts` | Paginated, filterable queries for transactions (by type, category, date range, amount range) plus single-record CRUD. |
| `CategoryRepository.ts` | Category CRUD with hierarchical support (parent/children relations) scoped to the authenticated user. |
| `BudgetRepository.ts` | Budget CRUD with optional month filtering, always includes the related category for display. |
| `DashboardRepository.ts` | Aggregation queries — income/expense totals, top spending categories, and monthly trend via raw SQL for efficient grouping. |

---

## `src/services/`

| Module | Purpose |
|--------|---------|
| `AuthService.ts` | Handles registration (duplicate check + password hashing) and login (credential verification + JWT issuance). |
| `TransactionService.ts` | Orchestrates transaction CRUD — delegates to the repository and will handle currency conversion on create/update. |
| `CategoryService.ts` | Thin service over `CategoryRepository` — enforces not-found checks and user ownership. |
| `BudgetService.ts` | Budget CRUD plus a `getStatus()` method (placeholder) that will compute budget-vs-actual per category. |
| `DashboardService.ts` | Aggregates totals, top categories, and monthly trends into a single dashboard summary response. |
| `CurrencyService.ts` | Exposes supported currencies and stored exchange rates; will provide mock rate seeding for development. |
| `CsvImportService.ts` | Parses uploaded CSV files and bulk-creates transactions — bridges `csvParser` util with the transaction repository. |
| `ReportService.ts` | Gathers financial summaries and feeds them into the PDF generator to produce downloadable monthly reports. |
| `BankSyncService.ts` | Simulates external bank sync by creating sync log entries; will generate mock transactions in full implementation. |
| `SavingsAIService.ts` | Accepts pre-aggregated monthly summaries (never raw data) and returns heuristic savings recommendations — the AI privacy boundary. |

---

## `src/api/routes/`

| Module | Purpose |
|--------|---------|
| `auth.ts` | Public endpoints — `POST /register`, `POST /login`, `POST /logout`, `GET /me`. Sets/clears httpOnly cookies on login/logout. |
| `transactions.ts` | Full CRUD on `/api/transactions` with pagination, filtering, and Zod validation. Protected by auth middleware. |
| `categories.ts` | CRUD on `/api/categories` — list, create, update, delete user-owned categories. |
| `budgets.ts` | CRUD on `/api/budgets` plus `GET /status` for budget-vs-actual tracking by month. |
| `dashboard.ts` | `GET /api/dashboard` — returns aggregated financial summary for a date range. |
| `reports.ts` | `GET /api/reports/monthly` — streams a generated PDF back to the client. |
| `sync.ts` | `POST /api/sync/mock` (trigger mock bank sync), `POST /api/sync/csv` (upload CSV), `GET /api/sync/history`. |
| `ai.ts` | `GET /api/ai/recommendations` — returns AI-generated savings suggestions. |
| `index.ts` | Route aggregator — mounts all route modules under `/api` and applies `authenticate` middleware to all protected groups. |

---

## `src/` (Root Bootstrap)

| Module | Purpose |
|--------|---------|
| `app.ts` | Creates and configures the Express app — registers global middleware (CORS, JSON parsing, cookies, request logging), mounts the API router, and attaches the error handler last. |
| `main.ts` | Entry point — connects to the database, starts the HTTP server, and registers `SIGINT` / `SIGTERM` handlers for graceful shutdown. |
