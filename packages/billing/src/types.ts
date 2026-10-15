import type { CalculationDTO, EligibilityCheckDTO, EraSystem, EvidenceDTO } from "@ghost/shared";

export type EvidenceRole = EvidenceDTO["role"];
export type RuleOutcome = EligibilityCheckDTO["outcome"];

export type FactLine = { externalId: string; productName: string; quantity: number; unitPriceCents: number; totalCents: number };

export type FactDeal = {
  externalId: string;
  name: string;
  isWon: boolean;
  isClosed: boolean;
  amountCents: number | null;
  closeDate: string | null;
  lines: FactLine[];
};

export type CustomerFacts = {
  customerId: string;
  eraAccountId: string;
  name: string;
  status: "active" | "churned" | "prospect";
  deals: FactDeal[];
  orders: { externalId: string; dealExternalId: string | null; status: string }[];
  contracts: { externalId: string; status: string; description: string | null; specialTerms: string | null }[];
  invoicedDealExternalIds: string[]; // deals already on a Ghost/Stripe invoice (draft|open|paid)
  identitySystems: EraSystem[];
  signals: { usage: number; dispute: number }; // counts of usage_signal / dispute_signal source records
};

export type DetectedFindingLine = {
  dealExternalId: string;
  lineExternalId: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
};

export type DetectedFinding = {
  kind: "won_not_billed";
  title: string;
  amountCents: number;
  calculation: CalculationDTO;
  lines: DetectedFindingLine[];
};

export type InvoicePolicy = { amountCapCents: number };

export type Decision = { status: "ready_for_approval" | "needs_review" | "escalated"; reason: string };
