"use client";
import { useQuery } from "@tanstack/react-query";
import type { AuditEventDTO } from "@ghost/shared";
import { api } from "../api";
import { keys } from "./keys";

export type Page<T> = { items: T[]; nextCursor: string | null };

/** Live agent activity stream: the audit feed, polled every 1.5s. */
export function useActivity() {
  return useQuery({
    queryKey: keys.activity,
    queryFn: () => api<Page<AuditEventDTO>>("/api/v1/activity"),
    refetchInterval: 1500,
  });
}
