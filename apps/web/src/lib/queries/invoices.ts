"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InvoiceDTO } from "@ghost/shared";
import { api } from "../api";
import { keys } from "./keys";

/** Pulls the invoice from Stripe (authoritative) and refreshes everything the paid transition touches. */
export function useRefreshInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => api<InvoiceDTO>(`/api/v1/invoices/${encodeURIComponent(invoiceId)}/refresh`, { method: "POST" }),
    onSuccess: () => {
      for (const key of [keys.findingsAll, keys.overview, keys.activity, keys.auditAll, keys.collections]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
