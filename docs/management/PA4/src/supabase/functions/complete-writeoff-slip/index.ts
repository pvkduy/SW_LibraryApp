/**
 * Edge Function: complete-writeoff-slip (FR-COND-02/03, UC-22)
 *
 * Atomically validates eligibility/evidence, transitions every staged copy to
 * its target status, writes immutable `write_off` transactions, and runs the
 * POL-07 non-circulating queue rule.
 */
import { fail, handleOptions } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'
import { requiredString, runInventoryRpc } from '../_shared/inventory-rpc.ts'

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

  const slipId = requiredString(body.slip_id ?? body.slipId)
  if (!slipId) return fail('VALIDATION_FAILED', 'Missing required parameter: slip_id')

  return runInventoryRpc(
    auth.supabaseAdmin,
    'rpc_complete_writeoff_slip',
    { p_actor_id: auth.user.id, p_slip_id: slipId },
    'Write-off slip completed and locked as immutable.',
  )
})
