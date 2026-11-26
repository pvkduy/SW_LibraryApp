/**
 * Edge Function: cancel-writeoff-slip (FR-COND-03, UC-22 §2.2.5)
 *
 * Only draft slips can be cancelled. No copy state or inventory transaction is
 * touched.
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
    'rpc_cancel_writeoff_slip',
    {
      p_actor_id: auth.user.id,
      p_slip_id: slipId,
      p_reason: typeof body.reason === 'string' ? body.reason : null,
    },
    'Write-off slip cancelled.',
  )
})
