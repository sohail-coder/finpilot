export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "JPY",
  "CAD",
  "AUD",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_BASE_CURRENCY: SupportedCurrency = "USD";

export const DEFAULT_CATEGORIES = {
  income: ["Salary", "Freelance", "Investments", "Gifts", "Other Income"],
  expense: [
    "Food & Dining",
    "Transportation",
    "Housing",
    "Utilities",
    "Entertainment",
    "Healthcare",
    "Shopping",
    "Education",
    "Travel",
    "Other Expense",
  ],
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const CSV_IMPORT = {
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_MIME_TYPES: ["text/csv", "application/vnd.ms-excel"],
} as const;

export const BUDGET_THRESHOLDS = {
  WARNING_PERCENT: 80,
  DANGER_PERCENT: 100,
} as const;
