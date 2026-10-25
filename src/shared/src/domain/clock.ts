/**
 * Clock — test seam required by NFR-16 and SRS 10.6.
 *
 * SQL side: `app_now()` returns `now()` unless the session setting
 * `app.test_now` is set. This interface is the TypeScript counterpart so
 * domain functions can be tested with a fixed time.
 */

export interface Clock {
  now(): Date
}

export const systemClock: Clock = {
  now: () => new Date(),
}

/** A clock frozen at a given instant (tests only). */
export function fixedClock(iso: string): Clock {
  const at = new Date(iso)
  return { now: () => new Date(at) }
}
