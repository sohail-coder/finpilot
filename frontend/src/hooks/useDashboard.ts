import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../lib/api";

export function useDashboard(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["dashboard", startDate, endDate],
    queryFn: () => fetchDashboard(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}
