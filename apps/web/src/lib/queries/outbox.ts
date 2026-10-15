"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OutboxMessageDTO } from "@ghost/shared";
import { api, qs } from "../api";
import { keys } from "./keys";

export type OutboxStatusFilter = OutboxMessageDTO["status"];

export function useOutbox(status?: OutboxStatusFilter) {
  return useQuery({ queryKey: keys.outbox(status), queryFn: () => api<OutboxMessageDTO[]>(`/api/v1/outbox${qs({ status })}`) });
}

export function useDecideOutbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approve" | "reject" }) =>
      api<OutboxMessageDTO>(`/api/v1/outbox/${encodeURIComponent(id)}/${decision}`, { method: "POST" }),
    onSuccess: () => {
      for (const key of [keys.outboxAll, keys.collections, keys.expansion, keys.activity, keys.auditAll]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
