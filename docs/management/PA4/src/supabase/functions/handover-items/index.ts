/**
 * Edge Function: handover-items
 *
 * Implements FR-CIRC-02 / UC-20 (SRS §12.4).
 * Staff hand a requested book to the student at the counter, with optional
 * physical barcode verification (UC-20 §2.2.3) and counter fee collection
 * for awaiting_payment Premium items (UC-20 §2.2.4).
 */

import { fail, handleOptions, json } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'
import { HttpStatus, type ReasonCode } from '../../../shared/src/reason-codes/index.ts'

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
  const conditionOutMedia = body.condition_out_media ?? []
  const expectedBarcode = typeof (body.expected_barcode ?? body.expectedBarcode) === 'string'
    ? (body.expected_barcode ?? body.expectedBarcode).trim() || null
    : null
  const collectCounterFee = Boolean(body.collect_counter_fee ?? body.collectCounterFee ?? false)
  const amountCollected = Number(body.amount_collected ?? body.amountCollected ?? 0)

  if (!loanItemId) {
    return fail('VALIDATION_FAILED', 'Missing required parameter: loan_item_id')
  }

  if (!['good', 'fair', 'poor', 'damaged'].includes(conditionOut)) {
    return fail('VALIDATION_FAILED', 'Outgoing condition must be good, fair, poor, or damaged')
  }

  const mediaPrefix = `handover/${loanItemId}/`
  if (
    !Array.isArray(conditionOutMedia) ||
    conditionOutMedia.length > 3 ||
    conditionOutMedia.some((path: unknown) =>
      typeof path !== 'string' ||
      !path.startsWith(mediaPrefix) ||
      !/^[0-9a-f-]+\.(jpg|png|webp)$/i.test(path.slice(mediaPrefix.length))
    )
  ) {
    return fail('VALIDATION_FAILED', 'Handover media must contain up to three valid evidence paths')
  }

  // 1. Fetch item and standing for fast pre-checks
  const { data: item, error: fetchErr } = await supabaseAdmin
    .from('loan_items')
    .select(`
      id, status, fee, pickup_deadline, duration_days,
      profiles:uid ( id, status, debt_outstanding ),
      copies ( id, barcode, status )
    `)
    .eq('id', loanItemId)
    .single()

  if (fetchErr || !item) {
    return fail('NOT_FOUND', 'Loan item record not found')
  }

  // 2. Enforce Business Rules & Gating
  if (item.status === 'awaiting_payment') {
    if (!collectCounterFee) {
      return fail('STATUS_CHANGED', `Item requires counter fee settlement (${item.fee} VND) before handover.`, {
        currentStatus: item.status,
      })
    }
    if (!Number.isFinite(amountCollected) || amountCollected < (item.fee || 0)) {
      return fail('VALIDATION_FAILED', `Amount collected (${amountCollected} VND) cannot be less than required fee (${item.fee} VND).`)
    }
  } else if (item.status !== 'ready_for_pickup') {
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
    return fail('DEADLINE_PASSED', 'Pickup deadline passed. Request has expired.')
  }

  // 3. Execute atomic Handover via DB RPC (re-checks under FOR UPDATE lock)
  const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('rpc_confirm_handover_for_admin', {
    p_admin_id: auth.user.id,
    p_loan_item_id: loanItemId,
    p_condition_out: conditionOut,
    p_notes: notes,
    p_condition_out_media: conditionOutMedia,
    p_expected_barcode: expectedBarcode,
    p_collect_counter_fee: collectCounterFee,
    p_amount_collected: Number.isFinite(amountCollected) ? Math.trunc(amountCollected) : 0,
  })

  if (rpcErr || (rpcRes && !rpcRes.success)) {
    const rawReason = rpcRes?.reason
    const reason: ReasonCode = typeof rawReason === 'string' && rawReason in HttpStatus
      ? (rawReason as ReasonCode)
      : 'INTERNAL'
    return fail(reason, rpcErr?.message || rpcRes?.error || 'Handover execution failed')
  }

  return json({
    success: true,
    data: rpcRes,
    message: rpcRes?.receipt_number
      ? `Counter payment settled (${rpcRes.receipt_number}) and handover completed.`
      : 'Handover completed successfully. Loan is now active.',
  })
})
