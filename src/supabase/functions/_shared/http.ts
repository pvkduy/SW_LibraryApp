/**
 * Shared Edge Function helpers (SRS §10.1, §12.5).
 *
 * Keep this thin: validation, authorization, and the error envelope only.
 * Business rules belong in @shelfhelp/shared.
 */

import { HttpStatus, type ReasonCode } from '@shelfhelp/shared'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** The standard error envelope from SRS §12.5. */
export function fail(
  reason: ReasonCode,
  message: string,
  details?: unknown,
): Response {
  return json({ error: { reason, message, ...(details !== undefined ? { details } : {}) } }, HttpStatus[reason])
}

export function handleOptions(): Response {
  return new Response('ok', { headers: CORS_HEADERS })
}
