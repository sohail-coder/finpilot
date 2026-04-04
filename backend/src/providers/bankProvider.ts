import { logger } from "../utils/logger";

// ── Provider interface ───────────────────────────────────
// Any bank data source (Plaid, Yodlee, mock) implements this contract.
// The BankSyncService programs against this interface — swap providers
// without touching business logic.

export interface BankTransaction {
  /** Provider-specific unique ID (used for deduplication) */
  externalId: string;
  date: string; // ISO date string YYYY-MM-DD
  amount: number; // positive = income, negative = expense
  currency: string;
  description: string;
  /** Raw category hint from the provider (best-effort, may not match user categories) */
  categoryHint: string;
  /** Optional merchant name */
  merchant?: string;
}

export interface BankAccount {
  accountId: string;
  name: string;
  institution: string;
  type: string; // checking, savings, credit, etc.
  currency: string;
}

export interface BankProvider {
  /** A unique name for this provider (e.g. "mock", "plaid") */
  readonly name: string;

  /**
   * Fetch recent transactions from the bank.
   * In a real provider this would call an external API.
   * @param userId - Internal user ID (used to scope credentials / access tokens)
   * @param accountId - Optional account filter
   * @param fromDate - Oldest date to fetch (inclusive)
   */
  fetchTransactions(
    userId: string,
    accountId?: string,
    fromDate?: string,
  ): Promise<BankTransaction[]>;

  /** List connected accounts. */
  getAccounts(userId: string): Promise<BankAccount[]>;
}

// ── Mock provider ────────────────────────────────────────
// Returns deterministic sample data. Useful for development,
// demos, and testing the sync pipeline end-to-end.

function randomId(): string {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Return a date string guaranteed to be within the current month */
function currentMonthDate(dayOffset: number): string {
  const now = new Date();
  const day = Math.max(now.getDate() - dayOffset, 1); // clamp to 1st of month
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${String(day).padStart(2, "0")}`;
}

const SAMPLE_TRANSACTIONS: Omit<BankTransaction, "externalId">[] = [
  { date: currentMonthDate(0), amount: -45.99, currency: "USD", description: "Whole Foods Market", categoryHint: "Food & Dining", merchant: "Whole Foods" },
  { date: currentMonthDate(0), amount: -12.50, currency: "USD", description: "Uber ride downtown", categoryHint: "Transportation", merchant: "Uber" },
  { date: currentMonthDate(0), amount: 3200.00, currency: "USD", description: "Monthly salary deposit", categoryHint: "Salary", merchant: "FinCorp Inc" },
  { date: currentMonthDate(0), amount: -89.00, currency: "USD", description: "Electric bill payment", categoryHint: "Utilities", merchant: "City Power" },
  { date: currentMonthDate(1), amount: -32.00, currency: "USD", description: "Netflix + Spotify", categoryHint: "Entertainment", merchant: "Netflix" },
  { date: currentMonthDate(2), amount: -150.00, currency: "USD", description: "Health insurance copay", categoryHint: "Healthcare", merchant: "BlueCross" },
  { date: currentMonthDate(3), amount: -67.80, currency: "USD", description: "Amazon order #1234", categoryHint: "Shopping", merchant: "Amazon" },
  { date: currentMonthDate(4), amount: 500.00, currency: "USD", description: "Freelance project payment", categoryHint: "Freelance", merchant: "Client ABC" },
  { date: currentMonthDate(5), amount: -220.00, currency: "USD", description: "Flight booking LAX-SFO", categoryHint: "Travel", merchant: "United Airlines" },
  { date: currentMonthDate(6), amount: -15.00, currency: "USD", description: "Coursera subscription", categoryHint: "Education", merchant: "Coursera" },
];

export class MockBankProvider implements BankProvider {
  readonly name = "mock";

  async fetchTransactions(
    _userId: string,
    _accountId?: string,
    _fromDate?: string,
  ): Promise<BankTransaction[]> {
    logger.info("MockBankProvider: generating sample transactions");

    // Assign unique external IDs to each transaction
    return SAMPLE_TRANSACTIONS.map((tx) => ({
      ...tx,
      externalId: randomId(),
    }));
  }

  async getAccounts(_userId: string): Promise<BankAccount[]> {
    return [
      {
        accountId: "mock_checking_001",
        name: "Mock Checking Account",
        institution: "Mock Bank",
        type: "checking",
        currency: "USD",
      },
      {
        accountId: "mock_savings_001",
        name: "Mock Savings Account",
        institution: "Mock Bank",
        type: "savings",
        currency: "USD",
      },
    ];
  }
}
