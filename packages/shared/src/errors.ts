import type { ErrorCode } from "./contracts";

export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  CONFLICT: 409,
  POLICY_BLOCKED: 422,
  UPSTREAM_ERA: 502,
  UPSTREAM_STRIPE: 502,
  UPSTREAM_COGNEE: 502,
  UPSTREAM_LLM: 502,
  WEBHOOK_SIGNATURE: 400,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
  get status(): number {
    return HTTP_STATUS[this.code];
  }
  toEnvelope() {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}
