"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FindingDetailDTO, FindingStatus, FindingSummaryDTO } from "@ghost/shared";
import { api, qs } from "../api";
import type { Page } from "./activity";
import { keys } from "./keys";

const IN_FLIGHT: ReadonlySet<FindingStatus> = new Set<FindingStatus>(["analyzing", "approved", "invoiced"]);

export function useFindings(q: { status?: FindingStatus } = {}) {
  return useQuery({
    queryKey: keys.findings(q.status),
    queryFn: () => api<Page<FindingSummaryDTO>>(`/api/v1/findings${qs({ status: q.status })}`),
  });
}

/** Polls every 2s while the agent or Stripe is still working on the case. */
export function useFinding(id: string) {
  return useQuery({
    queryKey: keys.finding(id),
    queryFn: () => api<FindingDetailDTO>(`/api/v1/findings/${encodeURIComponent(id)}`),
    refetchInterval: (query) => (query.state.data && IN_FLIGHT.has(query.state.data.status) ? 2000 : false),
  });
}

function useFindingMutation<V>(call: (id: string, v: V) => Promise<FindingDetailDTO>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & V) => call(id, rest as V),
    onSuccess: (detail, { id }) => {
      qc.setQueryData(keys.finding(id), detail);
      for (const key of [keys.findingsAll, keys.overview, keys.activity, keys.auditAll, keys.customersAll, ["collections"]]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useAnalyzeFinding() {
  return useFindingMutation<Record<string, never>>((id) => api<FindingDetailDTO>(`/api/v1/findings/${encodeURIComponent(id)}/analyze`, { method: "POST" }));
}

export function useApproveFinding() {
  return useFindingMutation<{ note?: string }>((id, v) =>
    api<FindingDetailDTO>(`/api/v1/findings/${encodeURIComponent(id)}/approve`, { method: "POST", body: v }),
  );
}

export function useRejectFinding() {
  return useFindingMutation<{ reason: string }>((id, v) =>
    api<FindingDetailDTO>(`/api/v1/findings/${encodeURIComponent(id)}/reject`, { method: "POST", body: v }),
  );
}
