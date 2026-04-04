import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../lib/api";
import { insightState } from "../lib/insightState";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilters,
} from "../types";

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => fetchTransactions(filters),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => createTransaction(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); insightState.markDirty(); },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateTransactionInput;
    }) => updateTransaction(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); insightState.markDirty(); },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); insightState.markDirty(); },
  });
}
