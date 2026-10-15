"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExpansionDTO } from "@ghost/shared";
import { api } from "../api";
import { keys } from "./keys";

export function useExpansion() {
  return useQuery({ queryKey: keys.expansion, queryFn: () => api<ExpansionDTO[]>("/api/v1/expansion") });
}

export function useScanExpansion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ created: number }>("/api/v1/expansion/scan", { method: "POST" }),
    onSuccess: () => {
      for (const key of [keys.expansion, keys.outboxAll, keys.activity, keys.overview, keys.auditAll]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
