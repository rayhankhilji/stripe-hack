"use client";
import { useQuery } from "@tanstack/react-query";
import type { AuditEventDTO } from "@ghost/shared";
import { api, qs } from "../api";
import type { Page } from "./activity";
import { keys } from "./keys";

export function useAudit(q: { subjectType?: string; subjectId?: string; cursor?: string } = {}) {
  return useQuery({
    queryKey: [...keys.audit(q.subjectType, q.subjectId), q.cursor ?? ""],
    queryFn: () => api<Page<AuditEventDTO>>(`/api/v1/audit${qs(q)}`),
  });
}
