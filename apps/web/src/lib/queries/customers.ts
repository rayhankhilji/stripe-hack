"use client";
import { useQuery } from "@tanstack/react-query";
import type { CustomerDetailDTO, CustomerSummaryDTO } from "@ghost/shared";
import { api, qs } from "../api";
import { keys } from "./keys";

export type KnowledgeHit = { text: string; sourceExternalIds: string[]; score: number | null; via: "cognee" | "fts" };

export function useCustomers(q?: string) {
  return useQuery({ queryKey: keys.customers(q), queryFn: () => api<CustomerSummaryDTO[]>(`/api/v1/customers${qs({ q })}`) });
}

export function useCustomer(id: string) {
  return useQuery({ queryKey: keys.customer(id), queryFn: () => api<CustomerDetailDTO>(`/api/v1/customers/${encodeURIComponent(id)}`) });
}

export function useCustomerContext(id: string, q: string) {
  return useQuery({
    queryKey: keys.customerContext(id, q),
    queryFn: () => api<KnowledgeHit[]>(`/api/v1/customers/${encodeURIComponent(id)}/context${qs({ q })}`),
    enabled: q.trim().length > 0,
  });
}
