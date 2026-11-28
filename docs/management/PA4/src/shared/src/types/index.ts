/**
 * Domain enumerations — copied from SRS §5 (domain model and lifecycles).
 *
 * Source of truth: specs/SHELFHELP_FULLSPEC.md §5, §12.1.
 * Values MUST match the database CHECK constraints in supabase/migrations.
 */

/** SRS §5.2 — Loan Item states (9). */
export const LOAN_ITEM_STATUSES = [
  'awaiting_payment',
  'payment_failed',
  'ready_for_pickup',
  'borrowed',
  'overdue',
  'returned',
  'expired',
  'cancelled',
  'lost',
] as const
export type LoanItemStatus = (typeof LOAN_ITEM_STATUSES)[number]

/** SRS §5.3 — Reservation states. */
export const RESERVATION_STATUSES = [
  'waiting',
  'ready_for_pickup',
  'fulfilled',
  'expired',
  'cancelled',
] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

/** SRS §5.4 / §4.13 — Copy states. */
export const COPY_STATUSES = [
  'available',
  'held',
  'borrowed',
  'damaged',
  'under_repair',
  'lost',
  'retired',
] as const
export type CopyStatus = (typeof COPY_STATUSES)[number]

/** SRS §5.5 / POL-02 — Account states. */
export const ACCOUNT_STATUSES = [
  'pending_verification',
  'active',
  'restricted',
  'inactive',
] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

/** SRS §5.5 — Payment states. */
export const PAYMENT_STATUSES = [
  'created',
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
  'refunded',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** SRS §5.5 — Charge states. */
export const CHARGE_STATUSES = ['unpaid', 'paid', 'waived', 'cancelled'] as const
export type ChargeStatus = (typeof CHARGE_STATUSES)[number]

/** SRS §4.10 — Charge types. */
export const CHARGE_TYPES = ['overdue_fine', 'damage_fee', 'loss_fee'] as const
export type ChargeType = (typeof CHARGE_TYPES)[number]

/** SRS §4.10 — Receipt types. */
export const RECEIPT_TYPES = [
  'membership',
  'premium_fee',
  'overdue_fine',
  'damage_fee',
  'loss_fee',
  'manual',
  'reversal',
] as const
export type ReceiptType = (typeof RECEIPT_TYPES)[number]

/** SRS §4.13 / DEC-38 — Condition scale. */
export const CONDITIONS = ['good', 'fair', 'poor', 'damaged'] as const
export type Condition = (typeof CONDITIONS)[number]

/** SRS DEC-51 — Collection type. */
export const COLLECTIONS = ['standard', 'premium'] as const
export type Collection = (typeof COLLECTIONS)[number]

/** SRS §12.1 — Book status. */
export const BOOK_STATUSES = ['active', 'draft'] as const
export type BookStatus = (typeof BOOK_STATUSES)[number]

/** SRS §2.1 — Roles. There is a single staff role (DEC-01). */
export const ROLES = ['student', 'admin'] as const
export type Role = (typeof ROLES)[number]
