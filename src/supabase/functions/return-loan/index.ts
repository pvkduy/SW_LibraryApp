/**
 * Edge Function: return-loan
 *
 * Implements FR-CIRC-03, FR-CIRC-04 / UC-21 (SRS §12.4).
 * Staff process physical book return, evaluate overdue fines and condition damage,
 * settle or record debt, and auto-promote waiting reservations.
 *
 * Error contracts:
 *   - UNAUTHENTICATED: Missing / invalid token
 *   - FORBIDDEN_ROLE: Caller is not an admin
 *   - NOT_FOUND: Barcode does not exist
 *   - NOT_AVAILABLE: Copy is not currently on loan
 *   - VALIDATION_FAILED: Invalid condition or parameters
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

  const barcode = (body.copy_barcode || body.barcode || '').trim()
  const conditionIn = body.condition_in || body.conditionIn || 'good'
  const conditionInNotes = body.condition_in_notes || null
  const conditionInMedia = body.condition_in_media ?? []
  const damageTier = Number(body.damage_tier ?? body.damageTier ?? 0)
  const settleNow = Boolean(body.settle_now ?? body.settleNow ?? false)
  const amountCollected = Number(body.amount_collected ?? body.amountCollected ?? 0)

  if (!barcode) {
    return fail('VALIDATION_FAILED', 'Missing required parameter: copy_barcode')
  }

  // 1. Verify copy and active loan item
  const { data: copy, error: copyErr } = await supabaseAdmin
    .from('copies')
    .select('id, barcode, status')
    .eq('barcode', barcode)
    .single()

  if (copyErr || !copy) {
    return fail('NOT_FOUND', `Copy with barcode "${barcode}" not found`)
  }

  const { data: loanItem, error: itemErr } = await supabaseAdmin
    .from('loan_items')
    .select('id, status, due_at')
    .eq('copy_id', copy.id)
    .in('status', ['borrowed', 'overdue'])
    .order('due_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (itemErr || !loanItem) {
    return fail('NOT_AVAILABLE', `Copy "${barcode}" is not currently on loan (Current status: ${copy.status})`)
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

  // 2. Execute Return transaction in PostgreSQL
  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('rpc_process_return_with_evidence', {
    p_copy_barcode: barcode,
    p_condition_in: conditionIn,
    p_damage_tier: damageTier,
    p_settle_now: settleNow,
    p_amount_collected: amountCollected,
    p_condition_in_notes: conditionInNotes,
    p_condition_in_media: conditionInMedia,
  })

  if (rpcErr || (result && !result.success)) {
    return fail('INTERNAL', rpcErr?.message || result?.error || 'Failed to process return')
  }

  return json({
    success: true,
    data: result,
    message: 'Book return processed successfully.',
  })
})
