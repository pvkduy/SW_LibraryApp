/**
 * Shared helper for the 008-inventory Edge Functions.
 *
 * Every inventory mutation is executed by a SECURITY DEFINER RPC that returns
 * `{ success, reason?, message?, ... }`. This helper unwraps that envelope into
 * the SRS §12.5 contract so the frontend can rely on one error shape.
 */
import { fail, json } from './http.ts'
import { HttpStatus, type ReasonCode } from '../../../shared/src/reason-codes/index.ts'

type JsonRecord = Record<string, unknown>

export async function runInventoryRpc(
  supabaseAdmin: any,
  functionName: string,
  params: JsonRecord,
  successMessage?: string,
): Promise<Response> {
  const { data, error } = await supabaseAdmin.rpc(functionName, params)

  if (error) {
    // A raised SQL exception (for example FORBIDDEN_ROLE) still carries the
    // contract token. Surface it as the proper HTTP status when possible.
    const message = String(error.message ?? 'Inventory operation failed')
    const token = message.match(/\b([A-Z][A-Z_]+)\b/)?.[1]
    if (token && token in HttpStatus) {
      return fail(token as ReasonCode, message)
    }
    return fail('INTERNAL', message)
  }

  const result = (data ?? {}) as JsonRecord
  if (result.success === false) {
    const reason = typeof result.reason === 'string' && result.reason in HttpStatus
      ? (result.reason as ReasonCode)
      : 'INTERNAL'
    const message = typeof result.message === 'string' ? result.message : 'Inventory operation failed'
    return fail(reason, message, result)
  }

  return json({
    success: true,
    data: result,
    ...(successMessage ? { message: successMessage } : {}),
  })
}

/** Small guard used by the thin function wrappers. */
export function requiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
