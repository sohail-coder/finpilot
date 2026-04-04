-- FinPilot Initial Migration
-- Generated from prisma/schema.prisma

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE "User" (
    "id"           TEXT         NOT NULL,
    "email"        TEXT         NOT NULL,
    "passwordHash" TEXT         NOT NULL,
    "name"         TEXT,
    "baseCurrency" TEXT         NOT NULL DEFAULT 'USD',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- ── Categories (with parent/child hierarchy) ───────────────
CREATE TABLE "Category" (
    "id"           TEXT         NOT NULL,
    "userId"       TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "parentId"     TEXT,
    "categoryType" TEXT         NOT NULL,
    "color"        TEXT         NOT NULL DEFAULT '#3B82F6',
    "icon"         TEXT,
    "isDefault"    BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_userId_name_parentId_key" ON "Category"("userId", "name", "parentId");
-- Category_userId_idx removed: redundant (covered by unique index prefix)
CREATE INDEX "Category_userId_categoryType_idx" ON "Category"("userId", "categoryType");

-- ── Transactions ───────────────────────────────────────────
CREATE TABLE "Transaction" (
    "id"                 TEXT           NOT NULL,
    "userId"             TEXT           NOT NULL,
    "categoryId"         TEXT           NOT NULL,
    "bankSyncLogId"      TEXT,
    "description"        TEXT,
    "amount"             DECIMAL(15,2)  NOT NULL,
    "baseCurrencyAmount" DECIMAL(15,2)  NOT NULL,
    "currency"           TEXT           NOT NULL,
    "exchangeRate"       DECIMAL(10,6),
    "transactionDate"    DATE           NOT NULL,
    "transactionType"    TEXT           NOT NULL,
    "tags"               TEXT[]         DEFAULT ARRAY[]::TEXT[],
    "notes"              TEXT,
    "isRecurring"        BOOLEAN        NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Transaction_userId_transactionDate_idx" ON "Transaction"("userId", "transactionDate");
CREATE INDEX "Transaction_userId_categoryId_idx"      ON "Transaction"("userId", "categoryId");
CREATE INDEX "Transaction_userId_transactionType_idx"  ON "Transaction"("userId", "transactionType");
CREATE INDEX "Transaction_userId_transactionType_transactionDate_idx" ON "Transaction"("userId", "transactionType", "transactionDate");
CREATE INDEX "Transaction_userId_categoryId_transactionDate_idx"     ON "Transaction"("userId", "categoryId", "transactionDate");
CREATE INDEX "Transaction_bankSyncLogId_idx"           ON "Transaction"("bankSyncLogId");

-- ── Budgets ────────────────────────────────────────────────
CREATE TABLE "Budget" (
    "id"             TEXT           NOT NULL,
    "userId"         TEXT           NOT NULL,
    "categoryId"     TEXT           NOT NULL,
    "amount"         DECIMAL(15,2)  NOT NULL,
    "month"          DATE           NOT NULL,
    "alertThreshold" DECIMAL(3,2)   NOT NULL DEFAULT 0.9,
    "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Budget_userId_categoryId_month_key" ON "Budget"("userId", "categoryId", "month");
CREATE INDEX "Budget_userId_month_idx" ON "Budget"("userId", "month");

-- ── Exchange Rates Cache ───────────────────────────────────
CREATE TABLE "ExchangeRate" (
    "id"             TEXT           NOT NULL,
    "baseCurrency"   TEXT           NOT NULL,
    "targetCurrency" TEXT           NOT NULL,
    "rate"           DECIMAL(10,6)  NOT NULL,
    "source"         TEXT           NOT NULL DEFAULT 'FIXED',
    "updatedAt"      TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_targetCurrency_key" ON "ExchangeRate"("baseCurrency", "targetCurrency");
-- ExchangeRate_baseCurrency_idx removed: redundant (covered by unique index prefix)

-- ── Bank Sync Logs ─────────────────────────────────────────
CREATE TABLE "BankSyncLog" (
    "id"               TEXT         NOT NULL,
    "userId"           TEXT         NOT NULL,
    "fileName"         TEXT,
    "source"           TEXT         NOT NULL DEFAULT 'CSV',
    "syncedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionCount" INTEGER      NOT NULL DEFAULT 0,
    "status"           TEXT         NOT NULL,
    "errorMessage"     TEXT,
    "metadata"         JSONB,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankSyncLog_pkey" PRIMARY KEY ("id")
);

-- BankSyncLog_userId_idx removed: redundant (covered by userId_status prefix)
CREATE INDEX "BankSyncLog_userId_status_idx" ON "BankSyncLog"("userId", "status");
CREATE INDEX "BankSyncLog_userId_createdAt_idx" ON "BankSyncLog"("userId", "createdAt");

-- ── AI Recommendations History ─────────────────────────────
CREATE TABLE "AIRecommendation" (
    "id"              TEXT           NOT NULL,
    "userId"          TEXT           NOT NULL,
    "month"           DATE           NOT NULL,
    "inputSummary"    JSONB          NOT NULL,
    "recommendations" JSONB          NOT NULL,
    "totalSavings"    DECIMAL(15,2),
    "status"          TEXT           NOT NULL DEFAULT 'GENERATED',
    "createdAt"       TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIRecommendation_userId_month_idx"  ON "AIRecommendation"("userId", "month");
CREATE INDEX "AIRecommendation_userId_status_idx" ON "AIRecommendation"("userId", "status");

-- ── Audit Logs ─────────────────────────────────────────────
CREATE TABLE "AuditLog" (
    "id"         TEXT         NOT NULL,
    "userId"     TEXT,
    "entityType" TEXT         NOT NULL,
    "entityId"   TEXT,
    "action"     TEXT         NOT NULL,
    "oldValues"  JSONB,
    "newValues"  JSONB,
    "ipAddress"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_entityType_idx" ON "AuditLog"("userId", "entityType");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ── Foreign Keys ───────────────────────────────────────────
ALTER TABLE "Category"         ADD CONSTRAINT "Category_userId_fkey"         FOREIGN KEY ("userId")        REFERENCES "User"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Category"         ADD CONSTRAINT "Category_parentId_fkey"       FOREIGN KEY ("parentId")      REFERENCES "Category"("id")    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction"      ADD CONSTRAINT "Transaction_userId_fkey"      FOREIGN KEY ("userId")        REFERENCES "User"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Transaction"      ADD CONSTRAINT "Transaction_categoryId_fkey"  FOREIGN KEY ("categoryId")    REFERENCES "Category"("id")    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction"      ADD CONSTRAINT "Transaction_bankSyncLogId_fkey" FOREIGN KEY ("bankSyncLogId") REFERENCES "BankSyncLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Budget"           ADD CONSTRAINT "Budget_userId_fkey"           FOREIGN KEY ("userId")        REFERENCES "User"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Budget"           ADD CONSTRAINT "Budget_categoryId_fkey"       FOREIGN KEY ("categoryId")    REFERENCES "Category"("id")    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankSyncLog"      ADD CONSTRAINT "BankSyncLog_userId_fkey"      FOREIGN KEY ("userId")        REFERENCES "User"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_userId_fkey" FOREIGN KEY ("userId")        REFERENCES "User"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "AuditLog"         ADD CONSTRAINT "AuditLog_userId_fkey"         FOREIGN KEY ("userId")        REFERENCES "User"("id")        ON DELETE SET NULL ON UPDATE CASCADE;
