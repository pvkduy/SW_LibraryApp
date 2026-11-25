/**
 * Edge Function: complete-simulated-payment
 *
 * Implements FR-CART-06 (Spec 004-cart-checkout).
 * Idempotently completes, fails, switches to counter, or cancels a simulated payment.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fail, handleOptions, json } from '../_shared/http.ts'
import type { ReasonCode } from '../../../shared/src/reason-codes/index.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return fail('UNAUTHENTICATED', 'Missing Authorization header')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321'
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return fail('UNAUTHENTICATED', authError?.message || 'Invalid authorization token')
  }

  let body: { payment_id?: string; outcome?: string }
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }

  if (!body.payment_id || !body.outcome) {
    return fail('VALIDATION_FAILED', 'Missing payment_id or outcome')
  }

  const { data, error } = await supabaseUser.rpc('rpc_complete_simulated_payment', {
    p_payment_id: body.payment_id,
    p_outcome: body.outcome,
  })

  if (error) {
    return fail('INTERNAL', error.message)
  }

  if (!data?.success) {
    const reason = (data?.reason as ReasonCode) ?? 'VALIDATION_FAILED'
    return fail(reason, data?.message ?? 'Payment update failed')
  }

  return json(data, 200)
})
