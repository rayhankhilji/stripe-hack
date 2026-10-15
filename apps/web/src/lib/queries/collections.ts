"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CollectionItemDTO } from "@ghost/shared";
import { api } from "../api";
import { keys } from "./keys";

export type SweepResult = { drafted: number; suppressed: number; escalated: number };

export function useCollections() {
  return useQuery({ queryKey: keys.collections, queryFn: () => api<CollectionItemDTO[]>("/api/v1/collections") });
}

export function useSweepCollections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<SweepResult>("/api/v1/collections/sweep", { method: "POST" }),
    onSuccess: () => {
      for (const key of [keys.collections, keys.outboxAll, keys.activity, keys.overview, keys.auditAll]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
