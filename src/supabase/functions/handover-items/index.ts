/**
 * Edge Function: handover-items
 *
 * Implements FR-CIRC-02 / UC-20 (SRS §12.4).
 * Staff hand a requested book to the student at the counter.
 *
 * Error contracts:
 *   - UNAUTHENTICATED: Missing / invalid token
 *   - FORBIDDEN_ROLE: Caller is not an admin
 *   - STATUS_CHANGED: Item not in ready_for_pickup status
 *   - ACCOUNT_NOT_ACTIVE: Student account is suspended or pending
 *   - DEBT_HOLD: Student owes unpaid charges
 *   - DEADLINE_PASSED: Pickup deadline has expired
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

  const loanItemId = body.loan_item_id || body.loanItemId
  const conditionOut = body.condition_out || body.conditionOut || 'good'
  const notes = body.notes || null

  if (!loanItemId) {
    return fail('VALIDATION_FAILED', 'Missing required parameter: loan_item_id')
  }

  // 1. Fetch item and standing
  const { data: item, error: fetchErr } = await supabaseAdmin
    .from('loan_items')
    .select(`
      id, status, pickup_deadline, duration_days,
      profiles ( id, status, debt_outstanding ),
      copies ( id, barcode, status )
    `)
    .eq('id', loanItemId)
    .single()

  if (fetchErr || !item) {
    return fail('NOT_FOUND', 'Loan item record not found')
  }

  // 2. Enforce Business Rules & Gating
  if (item.status !== 'ready_for_pickup') {
    return fail('STATUS_CHANGED', `Item is not ready for pickup (current: ${item.status})`, {
      currentStatus: item.status,
    })
  }

  const profile = (item as any).profiles
  if (profile?.status !== 'active') {
    return fail('ACCOUNT_NOT_ACTIVE', `Student account is not active (${profile?.status || 'unknown'})`)
  }

  if (profile?.debt_outstanding > 0) {
    return fail('DEBT_HOLD', `Student has outstanding debt of ${profile.debt_outstanding} VND. Please settle charges first.`)
  }

  if (item.pickup_deadline && new Date(item.pickup_deadline).getTime() < Date.now()) {
    return fail('DEADLINE_PASSED', 'Hold deadline has expired for this pickup request')
  }

  // 3. Execute atomic Handover via DB RPC
  const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('rpc_confirm_handover', {
    p_loan_item_id: loanItemId,
    p_condition_out: conditionOut,
    p_notes: notes,
  })

  if (rpcErr || (rpcRes && !rpcRes.success)) {
    return fail('INTERNAL', rpcErr?.message || rpcRes?.error || 'Handover execution failed')
  }

  return json({
    success: true,
    data: rpcRes,
    message: 'Handover completed successfully. Loan is now active.',
  })
})
