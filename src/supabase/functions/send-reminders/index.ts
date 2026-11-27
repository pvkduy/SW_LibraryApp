/**
 * Edge Function: send-reminders
 *
 * Implements UC-30 / FR-NOTIF-04 (SRS §12.4).
 * Dispatches individual or bulk ("Remind All") in-app return reminders for
 * active/overdue loans with 24-hour anti-spam cooldown filtering.
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

  const loanItemIds = Array.isArray(body.loan_item_ids ?? body.loanItemIds)
    ? (body.loan_item_ids ?? body.loanItemIds).filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
    : []
  const mode = body.mode === 'single' ? 'single' : 'bulk'
  const force = Boolean(body.force ?? false)

  if (loanItemIds.length === 0) {
    return fail('VALIDATION_FAILED', 'Provide at least one loan_item_id to remind')
  }

  const { data: result, error: rpcErr } = await auth.supabaseAdmin.rpc('rpc_send_loan_reminders_for_admin', {
    p_admin_id: auth.user.id,
    p_loan_item_ids: loanItemIds,
    p_mode: mode,
    p_force: force,
  })

  if (rpcErr || (result && !result.success)) {
    const rawReason = result?.reason
    const reasonCode: ReasonCode = typeof rawReason === 'string' && rawReason in HttpStatus
      ? (rawReason as ReasonCode)
      : 'INTERNAL'
    return fail(reasonCode, rpcErr?.message || result?.error || 'Failed to send reminders', result)
  }

  const sent = Number(result?.sent_count ?? 0)
  const skipped = Number(result?.skipped_count ?? 0)

  return json({
    success: true,
    data: result,
    message: mode === 'single'
      ? `Reminder sent to ${result?.student_name || 'student'}.`
      : `Bulk reminder complete: ${sent} reminder(s) dispatched, ${skipped} skipped due to 24-hour cooldown.`,
  })
})
