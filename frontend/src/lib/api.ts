import axios from "axios";
import type {
  ApiResponse,
  PaginatedResponse,
  User,
  Category,
  Transaction,
  Budget,
  BudgetStatus,
  DashboardSummary,
  CsvImportResult,
  BankSyncResult,
  BankSyncLog,
  SavingsPlan,
  SavingsPlanHistory,
  ReportSchedule,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateBudgetInput,
  UpdateBudgetInput,
  TransactionFilters,
} from "../types";

/** Extract a human-readable message from Axios or generic errors. */
export function extractErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api",
  withCredentials: true,
});

// ── Auth ──────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const { data } = await api.post<ApiResponse<User>>(
    "/auth/login",
    { email, password },
  );
  return data.data!;
}

export async function register(
  email: string,
  password: string,
  name: string,
  baseCurrency = "USD",
) {
  const { data } = await api.post<ApiResponse<User>>(
    "/auth/register",
    { email, password, name, baseCurrency },
  );
  return data.data!;
}

export async function fetchMe() {
  const { data } = await api.get<ApiResponse<User | null>>("/auth/me");
  return data.data ?? null;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function googleLogin(credential: string) {
  const { data } = await api.post<ApiResponse<User>>(
    "/auth/google",
    { credential },
  );
  return data.data!;
}

export async function fetchGoogleClientId() {
  const { data } = await api.get<ApiResponse<{ clientId: string | null }>>("/auth/google-client-id");
  return data.data!.clientId;
}

// ── Categories ────────────────────────────────────────────
export async function fetchCategories() {
  const { data } = await api.get<ApiResponse<Category[]>>("/categories");
  return data.data!;
}

export async function createCategory(input: CreateCategoryInput) {
  const { data } = await api.post<ApiResponse<Category>>("/categories", input);
  return data.data!;
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const { data } = await api.patch<ApiResponse<Category>>(
    `/categories/${id}`,
    input,
  );
  return data.data!;
}

export async function deleteCategory(id: string) {
  await api.delete(`/categories/${id}`);
}

// ── Transactions ──────────────────────────────────────────
export async function fetchTransactions(filters: TransactionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.type) params.set("type", filters.type);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  const { data } = await api.get<PaginatedResponse<Transaction>>(
    `/transactions?${params.toString()}`,
  );
  return data;
}

export async function fetchTransaction(id: string) {
  const { data } = await api.get<ApiResponse<Transaction>>(
    `/transactions/${id}`,
  );
  return data.data!;
}

export async function createTransaction(input: CreateTransactionInput) {
  const { data } = await api.post<ApiResponse<Transaction>>(
    "/transactions",
    input,
  );
  return data.data!;
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
) {
  const { data } = await api.patch<ApiResponse<Transaction>>(
    `/transactions/${id}`,
    input,
  );
  return data.data!;
}

export async function deleteTransaction(id: string) {
  await api.delete(`/transactions/${id}`);
}

// ── Budgets ───────────────────────────────────────────────
export async function fetchBudgets(month?: string) {
  const params = month ? `?month=${month}` : "";
  const { data } = await api.get<ApiResponse<Budget[]>>(`/budgets${params}`);
  return data.data!;
}

export async function fetchBudgetStatus(month: string) {
  const { data } = await api.get<ApiResponse<BudgetStatus[]>>(
    `/budgets/status?month=${month}`,
  );
  return data.data!;
}

export async function createBudget(input: CreateBudgetInput) {
  const { data } = await api.post<ApiResponse<Budget>>("/budgets", input);
  return data.data!;
}

export async function updateBudget(id: string, input: UpdateBudgetInput) {
  const { data } = await api.patch<ApiResponse<Budget>>(
    `/budgets/${id}`,
    input,
  );
  return data.data!;
}

export async function deleteBudget(id: string) {
  await api.delete(`/budgets/${id}`);
}

// ── Dashboard ─────────────────────────────────────────────
export async function fetchDashboard(startDate: string, endDate: string) {
  const { data } = await api.get<ApiResponse<DashboardSummary>>(
    `/dashboard?startDate=${startDate}&endDate=${endDate}`
  );
  return data.data!;
}

// ── CSV Import ────────────────────────────────────────────
export async function uploadCsvImport(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<ApiResponse<CsvImportResult>>(
    "/transactions/import",
    form,
  );
  return data.data!;
}

// ── Bank Sync ─────────────────────────────────────────────
export async function triggerBankSync(provider = "mock") {
  const { data } = await api.post<ApiResponse<BankSyncResult>>(
    "/sync/bank",
    { provider },
  );
  return data.data!;
}

export async function fetchSyncHistory() {
  const { data } = await api.get<ApiResponse<BankSyncLog[]>>("/sync/history");
  return data.data!;
}

export async function purgeSyncedTransactions() {
  const { data } = await api.delete<ApiResponse<{ deleted: number }>>("/sync/purge");
  return data.data!;
}

// ── Credit Card Recommendations ───────────────────────────
export async function fetchCreditCardRecommendations() {
  const { data } = await api.get<ApiResponse<import("../types").CreditCardInsight>>("/ai/credit-cards");
  return data.data!;
}

// ── Reports ───────────────────────────────────────────────
export async function downloadReportPdf(startDate: string, endDate: string) {
  const response = await api.get("/reports/pdf", {
    params: { startDate, endDate },
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finpilot-report-${startDate}-to-${endDate}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadTransactionsCsv(startDate?: string, endDate?: string) {
  const response = await api.get("/reports/csv", {
    params: { ...(startDate && { startDate }), ...(endDate && { endDate }) },
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const label = startDate && endDate ? `${startDate}-to-${endDate}` : "all";
  link.download = `finpilot-transactions-${label}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── AI Savings Plan ───────────────────────────────────────
export async function generateSavingsPlan(
  savingsGoal: number,
  startDate?: string,
  endDate?: string,
) {
  const { data } = await api.post<ApiResponse<SavingsPlan>>("/ai/savings-plan", {
    savingsGoal,
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  });
  return data.data!;
}

export async function fetchSavingsHistory() {
  const { data } = await api.get<ApiResponse<SavingsPlanHistory[]>>("/ai/history");
  return data.data!;
}

export async function updateSavingsPlanStatus(id: string, status: "ACCEPTED" | "DISMISSED") {
  await api.patch(`/ai/${id}/status`, { status });
}

export async function deleteSavingsPlan(id: string) {
  await api.delete(`/ai/${id}`);
}

// ── Report Schedule ───────────────────────────────────────
export async function fetchReportSchedule() {
  const { data } = await api.get<ApiResponse<ReportSchedule | null>>("/reports/schedule");
  return data.data ?? null;
}

export async function upsertReportSchedule(email: string) {
  const { data } = await api.post<ApiResponse<ReportSchedule>>("/reports/schedule", { email });
  return data.data!;
}

export async function deleteReportSchedule() {
  await api.delete("/reports/schedule");
}
