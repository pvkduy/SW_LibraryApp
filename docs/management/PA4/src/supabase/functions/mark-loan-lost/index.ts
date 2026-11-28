/**
 * Edge Function: mark-loan-lost
 *
 * Implements FR-CIRC-05 / 005b-loans-admin User Story 2.
 * Staff manually mark an active or overdue loan as lost with a mandatory reason.
 * Sets loan & copy to `lost`, restricts student account, creates `loss_fee` charge.
 */

import { fail, handleOptions, json } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'
import { HttpStatus, type ReasonCode } from '../../../shared/src/reason-codes/index.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireAdmin(req)
  if (auth.errorResponse) return auth.errorResponse

  let body: any
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }

  const loanItemId = body.loan_item_id || body.loanItemId
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!loanItemId) {
    return fail('VALIDATION_FAILED', 'Missing required parameter: loan_item_id')
  }
  if (!reason) {
    return fail('VALIDATION_FAILED', 'A mandatory reason is required to mark a loan as lost.')
  }

  const { data: result, error: rpcErr } = await auth.supabaseAdmin.rpc('rpc_mark_loan_lost_for_admin', {
    p_admin_id: auth.user.id,
    p_loan_item_id: loanItemId,
    p_reason: reason,
  })

  if (rpcErr || (result && !result.success)) {
    const rawReason = result?.reason
    const reasonCode: ReasonCode = typeof rawReason === 'string' && rawReason in HttpStatus
      ? (rawReason as ReasonCode)
      : 'INTERNAL'
    return fail(reasonCode, rpcErr?.message || result?.error || 'Failed to mark loan as lost')
  }

  return json({
    success: true,
    data: result,
    message: 'Loan marked as lost. Student account restricted and replacement charge recorded.',
  })
})
