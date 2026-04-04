# Bank Sync — Integration Design Notes

## Current Architecture

The bank sync feature is built on a **provider abstraction pattern** identical to
the one used for exchange rates (`RateProvider`). The core interface lives at
`backend/src/providers/bankProvider.ts`:

```
BankProvider (interface)
├── fetchTransactions(userId, accountId?, fromDate?) → BankTransaction[]
└── getAccounts(userId) → BankAccount[]
```

The `BankSyncService` programs **only** against this interface. It never
hard-codes provider-specific logic. Swapping or adding providers is a matter of
creating a new class that implements `BankProvider` and registering it.

### Data Flow

```
[Provider] → fetchTransactions() → BankSyncService
                                      ├── deduplication check
                                      ├── category resolution (hint → user category)
                                      ├── currency conversion
                                      ├── transaction creation (with bankSyncLogId FK)
                                      └── sync log update (SUCCESS / PARTIAL / FAILURE)
```

### Files

| File | Purpose |
|------|---------|
| `providers/bankProvider.ts` | `BankProvider` interface + `MockBankProvider` |
| `providers/index.ts` | Re-exports all provider types |
| `services/BankSyncService.ts` | Orchestrates sync: fetch → dedup → import → log |
| `repositories/BankSyncLogRepository.ts` | CRUD for `BankSyncLog` + dedup queries |
| `api/routes/sync.ts` | REST endpoints: POST /bank, GET /history, GET /providers |

---

## How to Integrate with Plaid

[Plaid](https://plaid.com/docs/) is the most common bank aggregation API. Here's
how this architecture maps to a Plaid integration:

### 1. Create `PlaidBankProvider`

```typescript
// providers/plaidProvider.ts

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type { BankProvider, BankTransaction, BankAccount } from "./bankProvider";

export class PlaidBankProvider implements BankProvider {
  readonly name = "plaid";
  private client: PlaidApi;

  constructor() {
    const config = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV ?? "sandbox"],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
        },
      },
    });
    this.client = new PlaidApi(config);
  }

  async fetchTransactions(userId: string, _accountId?: string, fromDate?: string) {
    // Look up the user's stored Plaid access_token from your DB
    const accessToken = await getStoredAccessToken(userId);

    const start = fromDate ?? thirtyDaysAgo();
    const end = today();

    const response = await this.client.transactionsGet({
      access_token: accessToken,
      start_date: start,
      end_date: end,
    });

    return response.data.transactions.map((tx) => ({
      externalId: tx.transaction_id,
      date: tx.date,
      amount: -tx.amount, // Plaid uses positive = debit
      currency: tx.iso_currency_code ?? "USD",
      description: tx.name,
      categoryHint: tx.category?.[0] ?? "Other",
      merchant: tx.merchant_name ?? undefined,
    }));
  }

  async getAccounts(userId: string) {
    const accessToken = await getStoredAccessToken(userId);
    const response = await this.client.accountsGet({ access_token: accessToken });

    return response.data.accounts.map((acc) => ({
      accountId: acc.account_id,
      name: acc.name,
      institution: "Plaid",
      type: acc.type,
      currency: acc.balances.iso_currency_code ?? "USD",
    }));
  }
}
```

### 2. Register the Provider

In `BankSyncService.ts`, add to the provider registry:

```typescript
import { PlaidBankProvider } from "../providers/plaidProvider";

const providers: Record<string, BankProvider> = {
  mock: new MockBankProvider(),
  plaid: new PlaidBankProvider(), // ← add here
};
```

### 3. Plaid Link (Frontend)

Plaid requires a frontend widget ("Plaid Link") to let users connect their bank:

1. Backend creates a `link_token` via `client.linkTokenCreate()`
2. Frontend opens Plaid Link with that token
3. User authenticates with their bank in the Plaid widget
4. Plaid returns a `public_token` to the frontend
5. Frontend sends `public_token` to the backend
6. Backend exchanges it for an `access_token` via `client.itemPublicTokenExchange()`
7. Store the `access_token` encrypted in a new `PlaidConnection` table

### 4. Database Changes for Plaid

You'd need a table to store Plaid credentials per user:

```prisma
model PlaidConnection {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(...)
  accessToken   String   // Encrypted at rest
  itemId        String
  institutionId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([userId, itemId])
}
```

### 5. Webhook Support

Plaid sends webhooks when new transactions are available or when connections
need re-authentication:

```
POST /api/sync/plaid-webhook
  → Verify webhook signature
  → If TRANSACTIONS_AVAILABLE: auto-trigger sync for that user
  → If PENDING_EXPIRATION: notify user to re-link
```

---

## Deduplication Strategy

The current implementation deduplicates by matching on
**description + date + amount** — a simple composite key that catches re-syncs
of the same data.

For a real Plaid integration, the better approach is:

1. Use Plaid's `transaction_id` as the `externalId`
2. Store `externalId` on the `Transaction` model
3. Before insert, query for existing transactions with matching `externalId`
4. This is more reliable than fuzzy matching on description/amount

To add this, you'd:
- Add `externalId String?` column to `Transaction` with a unique index per user
- Update `BankProvider.fetchTransactions()` to always return stable IDs
- Update dedup logic in `BankSyncService` to prefer `externalId` when present

---

## Other Providers

The same `BankProvider` interface works for any bank data source:

| Provider | Notes |
|----------|-------|
| **Plaid** | Most common in US/Canada. Sandbox available. |
| **Yodlee** | Global coverage. Similar API pattern. |
| **TrueLayer** | Strong in EU/UK. PSD2 compliant. |
| **Tink** | EU-focused. Visa-owned. |
| **MX** | US-focused. Good data enrichment. |
| **Manual CSV** | Already supported via the CSV import feature. |

Each would be a new class implementing `BankProvider`, registered in the
providers map. The sync pipeline, deduplication, and logging all work unchanged.
