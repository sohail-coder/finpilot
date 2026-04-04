import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBudgets,
  fetchBudgetStatus,
  createBudget,
  updateBudget,
  deleteBudget,
} from "../lib/api";
import type { CreateBudgetInput, UpdateBudgetInput } from "../types";

export function useBudgets(month?: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: () => fetchBudgets(month),
  });
}

export function useBudgetStatus(month: string) {
  return useQuery({
    queryKey: ["budgetStatus", month],
    queryFn: () => fetchBudgetStatus(month),
    enabled: !!month,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBudgetInput) => createBudget(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["budgetStatus"] });
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) =>
      updateBudget(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["budgetStatus"] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["budgetStatus"] });
    },
  });
}
