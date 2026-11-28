/**
 * Settings loader — typed access over the SRS §4.17 defaults.
 *
 * Server usage: read the `settings` row (key `library`) once at the start of a
 * transaction/job run and pass the value in (POL-18 settings timing).
 * This module must stay pure so it runs on Deno, Node, and the browser.
 */

import {
  DEFAULT_SETTINGS,
  type LibrarySettings,
  type MemberPrivileges,
} from './index'

/** Deep-merge persisted overrides on top of the defaults (partial settings rows). */
export function resolveSettings(overrides?: DeepPartial<LibrarySettings>): LibrarySettings {
  if (!overrides) return DEFAULT_SETTINGS
  return deepMerge(DEFAULT_SETTINGS, overrides) as LibrarySettings
}

/** The entitlement set for a student with no active membership (POL-03). */
export function nonMemberEntitlements(settings: LibrarySettings): MemberPrivileges {
  return settings.nonmember
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base
  if (typeof base !== 'object' || base === null) return override as T
  if (typeof override !== 'object') return override as T

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    const current = (base as Record<string, unknown>)[key]
    out[key] =
      current && typeof current === 'object' && !Array.isArray(current) && value && typeof value === 'object'
        ? deepMerge(current, value)
        : value
  }
  return out as T
}
