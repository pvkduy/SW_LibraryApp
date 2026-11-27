/**
 * Edge Function: cancel-reservation
 *
 * Implements FR-RES-05 / UC-29 / POL-07 (SRS §12.4).
 * Staff cancel a reservation with reason, or student cancels own reservation.
 * If holding a copy, the copy is automatically promoted to the next waiting member.
 *
 * Error contracts:
 *   - UNAUTHENTICATED: Missing / invalid token
 *   - NOT_FOUND: Reservation not found
 *   - STATUS_CHANGED: Reservation already fulfilled or cancelled
 *   - VALIDATION_FAILED: Missing reason
 */

import { authenticate } from '../_shared/auth.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await authenticate(req)
  if (auth.errorResponse) return auth.errorResponse

  let body: any
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }

  const reservationId = body.reservation_id || body.reservationId
  const reason = (body.reason || '').trim()

  if (!reservationId) {
    return fail('VALIDATION_FAILED', 'Missing required parameter: reservation_id')
  }

  const isAdmin = auth.user.app_metadata?.role === 'admin' && auth.profile.role === 'admin'
  if (isAdmin && auth.profile.status !== 'active') {
    return fail('ACCOUNT_NOT_ACTIVE', 'An active admin account is required')
  }
  if (!isAdmin) {
    if (auth.user.app_metadata?.role !== 'student' || auth.profile.role !== 'student') {
      return fail('FORBIDDEN_ROLE', 'Student role required')
    }
    if (!['active', 'restricted'].includes(auth.profile.status)) {
      return fail('ACCOUNT_NOT_ACTIVE', `Account is not eligible for this action (${auth.profile.status}).`)
    }
  }

  if (isAdmin && !reason) {
    return fail('VALIDATION_FAILED', 'Staff cancellation requires an explicit reason (UC-29)')
  }

  // 1. Fetch reservation
  const { data: resRecord, error: resErr } = await auth.supabaseAdmin
    .from('reservations')
    .select('id, uid, status, book_id, copy_id')
    .eq('id', reservationId)
    .single()

  if (resErr || !resRecord) {
    return fail('NOT_FOUND', 'Reservation record not found')
  }

  // If not admin, student can only cancel their own reservation
  if (!isAdmin && resRecord.uid !== auth.user.id) {
    return fail('FORBIDDEN_ROLE', 'Cannot cancel another patron\'s reservation')
  }

  if (['fulfilled', 'cancelled', 'expired'].includes(resRecord.status)) {
    return fail('STATUS_CHANGED', `Reservation is already ${resRecord.status}`)
  }

  // 2. Execute cancellation & promotion
  const { data: result, error: rpcErr } = await auth.supabaseAdmin.rpc('rpc_cancel_reservation_staff_for_user', {
    p_user_id: auth.user.id,
    p_reservation_id: reservationId,
    p_reason: reason || 'Patron voluntary cancellation',
  })

  if (rpcErr || (result && !result.success)) {
    return fail('INTERNAL', rpcErr?.message || result?.error || 'Cancellation failed')
  }

  return json({
    success: true,
    data: result,
    message: 'Reservation cancelled successfully. Next waiting patron promoted if applicable.',
  })
})
