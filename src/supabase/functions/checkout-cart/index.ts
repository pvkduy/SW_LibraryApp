/**
 * Edge Function: checkout-cart
 *
 * Implements FR-CART-03..06, FR-CART-08 (Spec 004-cart-checkout).
 * Atomically validates gating/quotas/duplicates, locks one available copy per line
 * (FOR UPDATE SKIP LOCKED), holds copies, creates Loan Request + Items + Receipts.
 */

import { requireUser } from '../_shared/auth.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'
import type { ReasonCode } from '../../../shared/src/reason-codes/index.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireUser(req)
  if (auth.errorResponse) return auth.errorResponse

  let body: {
    items?: Array<{ book_id: string; preferred_copy_id?: string | null; duration_days?: number }>
    payment_method?: string
    idempotency_key?: string
    simulate_failure?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return fail('VALIDATION_FAILED', 'Cart items array is required')
  }

  const { data, error } = await auth.supabaseAdmin.rpc('rpc_checkout_cart_for_user', {
    p_user_id: auth.user.id,
    p_items: body.items,
    p_payment_method: body.payment_method ?? 'mobile_banking',
    p_idempotency_key: body.idempotency_key ?? null,
    p_simulate_failure: Boolean(body.simulate_failure),
  })

  if (error) {
    return fail('INTERNAL', error.message)
  }

  if (!data?.success) {
    const reason = (data?.reason as ReasonCode) ?? 'VALIDATION_FAILED'
    return fail(reason, data?.message ?? 'Checkout failed', data?.line_errors)
  }

  return json(data, 200)
})
