// @ghost/billing — pure, deterministic billing engine. No I/O, no clock, integer cents only.
export type {
  CustomerFacts,
  Decision,
  DetectedFinding,
  DetectedFindingLine,
  EvidenceRole,
  FactDeal,
  FactLine,
  InvoicePolicy,
} from "./types";
export { detectWonNotBilled, WON_NOT_BILLED_VERSION } from "./detectors/won-not-billed";
export { evaluateEligibility, RULE_NAMES } from "./eligibility/rules";
export { decide } from "./decide";
export { evidenceScore } from "./evidence-score";
export { calcHash, canonicalJson, invoiceIdempotencyKey } from "./hash";
