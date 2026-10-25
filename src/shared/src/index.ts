/**
 * @shelfhelp/shared — public surface.
 *
 * Pure, environment-agnostic code only (SRS §11): must run unchanged on Deno,
 * Node, and the browser. No Node or Deno-specific APIs.
 *
 * M0a ships constants, enums, and interfaces. Business rules (entitlements,
 * gating, fines, promotion, lost, charges) are added by the milestone that owns
 * each rule — see M0-PLAN.md §6.
 */

export * from './types/index'
export * from './reason-codes/index'
export * from './settings-defaults/index'
export { resolveSettings, nonMemberEntitlements } from './settings-defaults/loader'
export type { Clock } from './domain/clock'
export { systemClock, fixedClock } from './domain/clock'
