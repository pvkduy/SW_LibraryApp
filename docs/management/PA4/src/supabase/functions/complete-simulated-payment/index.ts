/**
 * Edge Function: complete-simulated-payment
 *
 * Implements FR-CART-06 (Spec 004-cart-checkout).
 * Idempotently completes, fails, switches to counter, or cancels a simulated payment.
 */

import { requireUser } from '../_shared/auth.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'
import type { ReasonCode } from '../../../shared/src/reason-codes/index.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireUser(req)
  if (auth.errorResponse) return auth.errorResponse

  let body: { payment_id?: string; outcome?: string }
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }

  if (!body.payment_id || !body.outcome) {
    return fail('VALIDATION_FAILED', 'Missing payment_id or outcome')
  }

  const { data, error } = await auth.supabaseAdmin.rpc('rpc_complete_simulated_payment_for_user', {
    p_user_id: auth.user.id,
    p_payment_id: body.payment_id,
    p_outcome: body.outcome,
  })

  if (error) {
    return fail('INTERNAL', error.message)
  }

  if (!data?.success) {
    const reason = (data?.reason as ReasonCode) ?? 'VALIDATION_FAILED'
    return fail(reason, data?.message ?? 'Payment update failed')
  }

  return json(data, 200)
})
