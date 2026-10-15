"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { IngestRunDTO } from "@ghost/shared";
import { api } from "../api";

type IngestRun = ReturnType<typeof IngestRunDTO.parse>;
type IngestInput = { source?: "live" | "fixtures" };

/** Ingest, detection and reset change nearly every screen, so they refresh the whole cache. */
function useFullRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useRunIngest() {
  const refresh = useFullRefresh();
  return useMutation({
    mutationFn: (body: IngestInput = { source: "fixtures" }) => api<IngestRun>("/api/v1/ingest", { method: "POST", body, timeoutMs: 180_000 }),
    onSuccess: refresh,
  });
}

export function useRunDetection() {
  const refresh = useFullRefresh();
  return useMutation({
    mutationFn: () => api<{ created: number; updated: number; unchanged: number }>("/api/v1/detect", { method: "POST", timeoutMs: 120_000 }),
    onSuccess: refresh,
  });
}

export function useResetDemo() {
  const refresh = useFullRefresh();
  return useMutation({
    mutationFn: () => api<void>("/api/v1/demo/reset", { method: "POST", timeoutMs: 300_000 }),
    onSuccess: refresh,
  });
}
