/**
 * Edge Function: record-counter-payment
 *
 * Implements FR-CIRC-07 / TS-21 (SRS §12.4).
 * Staff collect fee/fine cash at the circulation counter, settle the charge,
 * update patron debt, and issue an immutable receipt.
 *
 * Error contracts:
 *   - UNAUTHENTICATED: Missing / invalid token
 *   - FORBIDDEN_ROLE: Caller is not an admin
 *   - NOT_FOUND: Charge record not found
 *   - PAYMENT_ALREADY_DONE: Charge already marked paid
 *   - VALIDATION_FAILED: Collected amount less than charge amount
 */

import { fail, handleOptions, json } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireAdmin(req)
  if (auth.errorResponse) return auth.errorResponse

  const { supabaseAdmin } = auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }

  const chargeId = body.charge_id || body.chargeId
  const amountCollected = Number(body.amount_collected ?? body.amountCollected ?? 0)
  const notes = body.notes || 'Counter settlement at circulation desk'

  if (!chargeId) {
    return fail('VALIDATION_FAILED', 'Missing required parameter: charge_id')
  }

  // 1. Fetch charge record
  const { data: charge, error: chargeErr } = await supabaseAdmin
    .from('charges')
    .select('id, uid, amount, status, type')
    .eq('id', chargeId)
    .single()

  if (chargeErr || !charge) {
    return fail('NOT_FOUND', 'Charge not found')
  }

  if (charge.status === 'paid') {
    return fail('PAYMENT_ALREADY_DONE', 'Charge has already been settled and paid')
  }

  if (amountCollected < charge.amount) {
    return fail(
      'VALIDATION_FAILED',
      `Amount collected (${amountCollected} VND) cannot be less than required charge (${charge.amount} VND)`,
      { required: charge.amount, collected: amountCollected }
    )
  }

  // 2. Execute atomic settlement & receipt issuance
  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('rpc_settle_counter_charge', {
    p_charge_id: chargeId,
    p_amount_collected: amountCollected,
    p_notes: notes,
  })

  if (rpcErr || (result && !result.success)) {
    return fail('INTERNAL', rpcErr?.message || result?.error || 'Failed to settle charge')
  }

  return json({
    success: true,
    data: result,
    message: `Payment settled successfully. Receipt ${result.receipt_number} issued.`,
  })
})
