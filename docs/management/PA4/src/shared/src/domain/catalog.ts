/**
 * Shared Catalog, Search, and Cart/Checkout domain rules (Spec 002 & 004).
 *
 * Pure, environment-agnostic TypeScript — runs identically in browser, Node, and Deno.
 * Source of truth: specs/002-catalog-search/spec.md, specs/004-cart-checkout/spec.md, POL-04, POL-05, POL-17.
 */

import { DEFAULT_SETTINGS, type LibrarySettings, type MemberPrivileges } from '../settings-defaults/index'

/** Old-style to new-style Vietnamese tone placement map (POL-17). */
const VI_TONE_CLUSTERS: ReadonlyArray<readonly [string, string]> = [
  ['oà', 'òa'],
  ['oá', 'óa'],
  ['oả', 'ỏa'],
  ['oã', 'õa'],
  ['oạ', 'ọa'],
  ['oè', 'òe'],
  ['oé', 'óe'],
  ['oẻ', 'ỏe'],
  ['oẽ', 'õe'],
  ['oẹ', 'ọe'],
  ['uỳ', 'ùy'],
  ['uý', 'úy'],
  ['uỷ', 'ủy'],
  ['uỹ', 'ũy'],
  ['uỵ', 'ụy'],
]

/**
 * Normalizes Vietnamese text for accent-exact matching (POL-17):
 * NFC normalization, lowercase, whitespace collapse, and canonical tone placement.
 */
export function normalizeViExact(input: string): string {
  if (!input) return ''
  let out = input.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')
  for (const [oldForm, newForm] of VI_TONE_CLUSTERS) {
    if (out.includes(oldForm)) {
      out = out.split(oldForm).join(newForm)
    }
  }
  return out
}

/**
 * Strips all diacritics and maps Vietnamese đ -> d for accent-insensitive search recall.
 */
export function stripDiacritics(input: string): string {
  if (!input) return ''
  return normalizeViExact(input)
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
}

/** Strips hyphens and spaces from an ISBN candidate. */
export function normalizeIsbn(raw: string): string {
  return (raw || '').replace(/[-\s]/g, '').toUpperCase()
}

/**
 * Validates an EAN-13 ISBN (978 or 979 prefix + valid Mod-10 checksum) per FR-SRCH-07.
 */
export function validateIsbn13Checksum(raw: string): boolean {
  const clean = normalizeIsbn(raw)
  if (!/^(978|979)\d{10}$/.test(clean)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(clean[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const expected = (10 - (sum % 10)) % 10
  return expected === Number(clean[12])
}

/** Validates either ISBN-13 (with checksum) or ISBN-10 format. */
export function isValidIsbn(raw: string): boolean {
  const clean = normalizeIsbn(raw)
  if (clean.length === 13) return validateIsbn13Checksum(clean)
  if (clean.length === 10 && /^\d{9}[\dX]$/.test(clean)) {
    let sum = 0
    for (let i = 0; i < 9; i++) sum += Number(clean[i]) * (10 - i)
    const last = clean[9] === 'X' ? 10 : Number(clean[9])
    return (sum + last) % 11 === 0
  }
  return false
}

/** Resolves effective borrowing privileges for a reader (POL-04). */
export function getEffectivePrivileges(
  isMember: boolean,
  settings: LibrarySettings = DEFAULT_SETTINGS,
): MemberPrivileges {
  const firstPlan = settings.plans[0]
  if (isMember && firstPlan) {
    return firstPlan.privileges
  }
  return settings.nonmember
}

/**
 * Computes borrow fee for a single cart/loan line (FR-CART-02, POL-05).
 * Standard books and active members are always free (0 VND).
 * Non-members pay `premium_fee_per_7_days` per 7-day block for Premium books.
 */
export function calculateBorrowFee(
  collection: 'standard' | 'premium' | string,
  durationDays: number,
  isMember: boolean,
  settings: LibrarySettings = DEFAULT_SETTINGS,
): number {
  if (collection !== 'premium' || isMember) return 0
  const blocks = Math.max(1, Math.ceil(durationDays / 7))
  return blocks * settings.premium_fee_per_7_days
}

/** Formats VND currency cleanly matching Figma (e.g., "5.000₫" or "Free"). */
export function formatVnd(amount: number, zeroLabel = 'Free'): string {
  if (!amount || amount <= 0) return zeroLabel
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`
}
