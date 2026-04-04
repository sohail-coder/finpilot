# Database Schema Reference

> 8 tables · PostgreSQL · Prisma ORM  
> Schema source of truth: `prisma/schema.prisma`

---

## Entity-Relationship Overview

```
User ──┬── Category (hierarchy via parentId self-relation)
       │      └── Transaction
       │      └── Budget
       ├── Transaction ←── BankSyncLog (optional import link)
       ├── Budget
       ├── BankSyncLog
       ├── AIRecommendation
       └── AuditLog

ExchangeRate (standalone lookup table)
```

---

## Table-by-Table Explanation

### 1. User

| Column | Type | Notes |
|--------|------|-------|
| `id` | CUID | Primary key |
| `email` | String | Unique, used for login |
| `passwordHash` | String | bcrypt hash (12 rounds) |
| `name` | String? | Display name |
| `baseCurrency` | String | User's preferred currency (default: USD) |
| `deletedAt` | DateTime? | Soft-delete flag — `null` = active |
| `createdAt`, `updatedAt` | DateTime | Audit timestamps |

**Why it exists:** Every feature is user-scoped. The soft-delete pattern lets us deactivate accounts without losing data integrity (foreign keys stay intact).

---

### 2. Category

| Column | Type | Notes |
|--------|------|-------|
| `id` | CUID | Primary key |
| `userId` | FK → User | Owner |
| `name` | String | Display name |
| `parentId` | FK → Category? | Self-relation for subcategories |
| `categoryType` | String | `'INCOME'` or `'EXPENSE'` |
| `color` | String | Hex color for UI display |
| `icon` | String? | Optional icon identifier |
| `isDefault` | Boolean | Seeded categories the user can't delete |
| Unique | `(userId, name, parentId)` | Prevents duplicate names at the same hierarchy level |

**Why it exists:** Categories are the backbone of financial classification. The self-referencing `parentId` enables a two-level hierarchy (e.g., "Food & Dining" → "Groceries", "Restaurants") without a separate subcategories table. The unique constraint on `(userId, name, parentId)` allows the same name at different hierarchy levels while preventing duplicates within one level.

---

### 3. Transaction

| Column | Type | Notes |
|--------|------|-------|
| `id` | CUID | Primary key |
| `userId` | FK → User | Owner |
| `categoryId` | FK → Category | Classification |
| `bankSyncLogId` | FK → BankSyncLog? | Links to the import batch if imported |
| `amount` | Decimal(15,2) | Original amount in `currency` |
| `baseCurrencyAmount` | Decimal(15,2) | Converted to user's base currency |
| `currency` | String | ISO 4217 code of the original currency |
| `exchangeRate` | Decimal(10,6)? | Rate used at transaction time |
| `transactionDate` | Date | When the transaction occurred |
| `transactionType` | String | `'INCOME'` or `'EXPENSE'` |
| `tags` | String[] | Flexible free-form labels |
| `notes` | String? | Additional user notes |
| `isRecurring` | Boolean | Flags recurring transactions for future automation |
| Indexes | 3 composites + bankSyncLogId | Optimized for dashboard queries, category views, and import lookups |

**Why it exists:** The core data entity. Stores both the original amount/currency AND the base-currency equivalent (locked at creation time along with the exchange rate). This avoids retroactive recalculation when rates change. The `bankSyncLogId` traces any imported transaction back to its source import.

**Multi-currency strategy:** On every create, the service calls `convertToBase()` which looks up the `ExchangeRate` table. The `amount` + `currency` preserves the real value; `baseCurrencyAmount` + `exchangeRate` enable consistent aggregation in the user's preferred currency.

---

### 4. Budget

| Column | Type | Notes |
|--------|------|-------|
| `id` | CUID | Primary key |
| `userId` | FK → User | Owner |
| `categoryId` | FK → Category | What category this budget covers |
| `amount` | Decimal(15,2) | Maximum spend for the month |
| `month` | Date | First day of the month (e.g., 2026-03-01) |
| `alertThreshold` | Decimal(3,2) | Fraction at which to warn (default: 0.9 = 90%) |
| Unique | `(userId, categoryId, month)` | One budget per category per month |

**Why it exists:** Enables per-category monthly spending limits. The unique constraint ensures no duplicate budgets. The `alertThreshold` allows the UI to show warnings before the user exceeds their budget (at 80%, 90%, etc.).

---

### 5. ExchangeRate

| Column | Type | Notes |
|--------|------|-------|
| `id` | CUID | Primary key |
| `baseCurrency` | String | Source currency |
| `targetCurrency` | String | Destination currency |
| `rate` | Decimal(10,6) | Conversion multiplier |
| `source` | String | `'FIXED'` for seeded rates, `'API'` for future live rates |
| `updatedAt` | DateTime | When the rate was last refreshed |
| Unique | `(baseCurrency, targetCurrency)` | One rate per currency pair |

**Why it exists:** Acts as a cache for exchange rates. For MVP, rates are seeded with fixed values. The `source` field future-proofs for plugging in a live exchange rate API. Both directions are stored (USD→EUR and EUR→USD) for O(1) lookups without calculation.

---

### 6. BankSyncLog

| Column | Type | Notes |
|--------|------|-------|
| `id` | CUID | Primary key |
| `userId` | FK → User | Who triggered the import |
| `fileName` | String? | Original file name for CSV imports |
| `source` | String | `'CSV'`, `'MOCK'`, or `'API'` |
| `syncedAt` | DateTime | When the sync was executed |
| `transactionCount` | Int | Number of transactions imported |
| `status` | String | `'PENDING'`, `'SUCCESS'`, `'FAILURE'`, `'PARTIAL'` |
| `errorMessage` | String? | Error details if failed |
| `metadata` | Json? | Flexible storage for import stats, column mappings, etc. |

**Why it exists:** Provides an audit trail for every data import. Users can see what was imported, when, and whether it succeeded. Transactions link back via `bankSyncLogId` so users can review or bulk-delete an entire import batch. The `metadata` JSON field allows extensibility without schema migrations.

---

### 7. AIRecommendation

| Column | Type | Notes |
|--------|------|-------|
| `id` | CUID | Primary key |
| `userId` | FK → User | Who the recommendations are for |
| `month` | Date | The month these recommendations cover |
| `inputSummary` | Json | Pre-aggregated monthly category totals (privacy boundary) |
| `recommendations` | Json | Array of `{ category, currentSpending, suggestedTarget, potentialSavings, rationale }` |
| `totalSavings` | Decimal(15,2)? | Sum of all potential savings |
| `status` | String | `'GENERATED'`, `'ACCEPTED'`, `'DISMISSED'` |

**Why it exists:** Persists the AI savings planner's output so users can review past recommendations, track whether they accepted/dismissed advice, and measure improvement over time. The `inputSummary` stores exactly what was sent to the AI (pre-aggregated — never raw transaction data), enforcing the privacy boundary described in the architecture. The `status` field enables a feedback loop.

---

### 8. AuditLog

| Column | Type | Notes |
|--------|------|-------|
| `id` | CUID | Primary key |
| `userId` | FK → User? | Who performed the action (null for system actions) |
| `entityType` | String | Table name (e.g., `'Transaction'`, `'Budget'`) |
| `entityId` | String? | ID of the affected record |
| `action` | String | `'CREATE'`, `'UPDATE'`, `'DELETE'`, `'REGISTER'`, etc. |
| `oldValues` | Json? | Previous state (for updates) |
| `newValues` | Json? | New state (for creates/updates) |
| `ipAddress` | String? | Request IP for security auditing |

**Why it exists:** Financial applications need accountability. The audit log captures who did what, when, and to which record — with before/after snapshots for changes. The nullable `userId` allows logging system-level events. This table is append-only by design and should never be updated or deleted.

---

## Design Decisions Summary

| Decision | Rationale |
|----------|-----------|
| **CUID primary keys** | URL-safe, sortable, no sequential enumeration risk (unlike auto-increment) |
| **Decimal(15,2) for money** | Avoids floating-point precision errors; 15 digits supports up to trillions |
| **Decimal(10,6) for rates** | 6 decimal places for accurate forex conversions |
| **Soft-delete on User only** | Preserves referential integrity; transactions/categories cascade on hard-delete |
| **Json fields for AI & metadata** | Flexible schema for evolving AI output and import stats without migrations |
| **Composite indexes** | Every query path that hits the dashboard or list views has a covering index |
| **Category self-relation** | Simple two-level hierarchy without a separate junction table |
| **Both currency directions stored** | O(1) lookup vs computing inverse rates with potential precision loss |

---

## How to Use

```bash
# Generate Prisma client (after schema changes)
npm run db:push        # push schema to DB (dev only)
npx prisma generate    # regenerate client types

# Run migrations (production)
npm run db:migrate

# Seed sample data
npm run db:seed

# Browse data visually
npm run db:studio
```
