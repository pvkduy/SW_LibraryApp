import { supabase } from './supabase'

/**
 * Calls a Supabase Edge Function and unwraps the standard error contract
 * (SRS §12.5): { error: { reason, message, details } }.
 *
 * Privileged writes go through Edge Functions, never direct table writes.
 */
export async function invokeFunction(name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    // FunctionsHttpError carries the response body on `error.context`
    let payload = null
    try {
      payload = await error.context?.json?.()
    } catch {
      // ignore: body was not JSON
    }
    const reason = payload?.error?.reason ?? 'INTERNAL'
    const message = payload?.error?.message ?? error.message ?? 'Request failed'
    const err = new Error(message)
    err.reason = reason
    err.details = payload?.error?.details ?? null
    throw err
  }

  return data
}

export const api = {
  invoke: invokeFunction,
}
