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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fail, handleOptions, json } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const authHeader = req.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321'
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!serviceRoleKey) {
    return fail('INTERNAL', 'Missing service role key')
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (!authHeader) {
    return fail('UNAUTHENTICATED', 'Missing Authorization header')
  }

  const supabaseUser = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
  if (authErr || !user) {
    return fail('UNAUTHENTICATED', 'Invalid token')
  }

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

  const isAdmin = user.app_metadata?.role === 'admin'
  if (isAdmin && !reason) {
    return fail('VALIDATION_FAILED', 'Staff cancellation requires an explicit reason (UC-29)')
  }

  // 1. Fetch reservation
  const { data: resRecord, error: resErr } = await supabaseAdmin
    .from('reservations')
    .select('id, uid, status, book_id, copy_id')
    .eq('id', reservationId)
    .single()

  if (resErr || !resRecord) {
    return fail('NOT_FOUND', 'Reservation record not found')
  }

  // If not admin, student can only cancel their own reservation
  if (!isAdmin && resRecord.uid !== user.id) {
    return fail('FORBIDDEN_ROLE', 'Cannot cancel another patron\'s reservation')
  }

  if (['fulfilled', 'cancelled', 'expired'].includes(resRecord.status)) {
    return fail('STATUS_CHANGED', `Reservation is already ${resRecord.status}`)
  }

  // 2. Execute cancellation & promotion
  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('rpc_cancel_reservation_staff', {
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
