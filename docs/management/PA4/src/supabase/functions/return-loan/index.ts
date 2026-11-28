/**
 * Edge Function: return-loan
 *
 * Implements FR-CIRC-03, FR-CIRC-04 / UC-21 (SRS §12.4).
 * Staff process physical book return, evaluate overdue fines (capped &
 * reconciled) and condition damage (tier or custom), settle at counter or
 * defer to debt, optionally recover a lost book (Path A), and auto-promote
 * waiting reservations.
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

  const barcode = (body.copy_barcode || body.barcode || '').trim()
  const conditionIn = body.condition_in || body.conditionIn || 'good'
  const conditionInNotes = body.condition_in_notes || null
  const conditionInMedia = body.condition_in_media ?? []
  const damageTier = Number(body.damage_tier ?? body.damageTier ?? 0)
  const settleNow = Boolean(body.settle_now ?? body.settleNow ?? false)
  const amountCollected = Number(body.amount_collected ?? body.amountCollected ?? 0)
  const nextCopyStatus = typeof (body.next_copy_status ?? body.nextCopyStatus) === 'string'
    ? (body.next_copy_status ?? body.nextCopyStatus).trim() || null
    : null
  const customDamageRaw = body.custom_damage_amount ?? body.customDamageAmount
  const customDamageAmount = customDamageRaw !== undefined && customDamageRaw !== null && customDamageRaw !== ''
    ? Number(customDamageRaw)
    : null
  const allowLostRecovery = Boolean(body.allow_lost_recovery ?? body.allowLostRecovery ?? false)

  if (!barcode) {
    return fail('VALIDATION_FAILED', 'Missing required parameter: copy_barcode')
  }
  if (!['good', 'fair', 'poor', 'damaged'].includes(conditionIn)) {
    return fail('VALIDATION_FAILED', 'Incoming condition must be good, fair, poor, or damaged')
  }
  if (nextCopyStatus !== null && !['available', 'damaged', 'under_repair'].includes(nextCopyStatus)) {
    return fail('VALIDATION_FAILED', 'Destination copy status must be available, damaged, or under_repair')
  }
  if (customDamageAmount !== null && (!Number.isFinite(customDamageAmount) || customDamageAmount < 0)) {
    return fail('VALIDATION_FAILED', 'Custom damage amount must be a non-negative number')
  }

  // 1. Verify copy and active (or lost) loan item
  const { data: copy, error: copyErr } = await supabaseAdmin
    .from('copies')
    .select('id, barcode, status')
    .eq('barcode', barcode)
    .single()

  if (copyErr || !copy) {
    return fail('NOT_FOUND', `Copy with barcode "${barcode}" not found`)
  }

  const allowedStatuses = allowLostRecovery ? ['borrowed', 'overdue', 'lost'] : ['borrowed', 'overdue']
  const { data: loanItem, error: itemErr } = await supabaseAdmin
    .from('loan_items')
    .select('id, status, due_at')
    .eq('copy_id', copy.id)
    .in('status', allowedStatuses)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (itemErr || !loanItem) {
    return fail('NOT_AVAILABLE', `Copy "${barcode}" is currently marked as ${copy.status}. No active borrowed loan found.`)
  }

  const mediaPrefix = `return/${loanItem.id}/`
  if (
    !Array.isArray(conditionInMedia) ||
    conditionInMedia.length > 3 ||
    conditionInMedia.some((path: unknown) =>
      typeof path !== 'string' ||
      !path.startsWith(mediaPrefix) ||
      !/^[0-9a-f-]+\.(jpg|png|webp)$/i.test(path.slice(mediaPrefix.length))
    )
  ) {
    return fail('VALIDATION_FAILED', 'Return media must contain up to three valid evidence paths')
  }

  // 2. Execute atomic Return transaction in PostgreSQL
  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('rpc_process_return_with_evidence_for_admin', {
    p_admin_id: auth.user.id,
    p_copy_barcode: barcode,
    p_condition_in: conditionIn,
    p_damage_tier: Number.isFinite(damageTier) ? Math.trunc(damageTier) : 0,
    p_settle_now: settleNow,
    p_amount_collected: Number.isFinite(amountCollected) ? Math.trunc(amountCollected) : 0,
    p_condition_in_notes: conditionInNotes,
    p_condition_in_media: conditionInMedia,
    p_next_copy_status: nextCopyStatus,
    p_custom_damage_amount: customDamageAmount !== null ? Math.trunc(customDamageAmount) : null,
    p_allow_lost_recovery: allowLostRecovery,
  })

  if (rpcErr || (result && !result.success)) {
    const rawReason = result?.reason
    const reason: ReasonCode = typeof rawReason === 'string' && rawReason in HttpStatus
      ? (rawReason as ReasonCode)
      : 'INTERNAL'
    return fail(reason, rpcErr?.message || result?.error || 'Failed to process return')
  }

  return json({
    success: true,
    data: result,
    message: result?.lost_recovery
      ? 'Lost book recovered and return processed (Path A).'
      : 'Book return processed successfully.',
  })
})
