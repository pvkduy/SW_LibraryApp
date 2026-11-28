/**
 * Error reason codes — copied verbatim from SRS §12.5 (error contract).
 *
 * Source of truth: specs/SHELFHELP_FULLSPEC.md §12.5.
 * Do not add a reason here without adding it to the SRS first.
 */

export const HttpStatus = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN_ROLE: 403,
  ACCOUNT_NOT_ACTIVE: 403,
  ACCOUNT_RESTRICTED: 403,
  DEBT_HOLD: 403,
  RESERVATION_BAN: 403,
  NOT_MEMBER: 403,
  NOT_FOUND: 404,
  NOT_AVAILABLE: 409,
  DUPLICATE_ACTIVE_LOAN: 409,
  QUEUE_FULL: 409,
  WISHLIST_FULL: 409,
  STATUS_CHANGED: 409,
  DUPLICATE: 409,
  PAYMENT_ALREADY_DONE: 409,
  PAYMENT_EXPIRED: 410,
  DEADLINE_PASSED: 410,
  LIMIT_REACHED: 422,
  RENEWAL_NOT_ALLOWED: 422,
  PRECONDITION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const

export type ReasonCode = keyof typeof HttpStatus

/** Reasons that can be returned by the gating function, in precedence order (SRS §6.1). */
export const GATING_PRECEDENCE = [
  'ACCOUNT_NOT_ACTIVE', // or ACCOUNT_RESTRICTED for a restricted account
  'DEBT_HOLD',
  'RESERVATION_BAN',
  'NOT_MEMBER',
  'LIMIT_REACHED',
] as const satisfies readonly ReasonCode[]

/** The standard error envelope returned by every Edge Function (SRS §12.5). */
export interface ApiErrorBody {
  error: {
    reason: ReasonCode
    message: string
    details?: unknown
  }
}

export function httpStatusFor(reason: ReasonCode): number {
  return HttpStatus[reason]
}
