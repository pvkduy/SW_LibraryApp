/**
 * Edge Function: change-copy-status (FR-INV-07, UC-19 §2.2.4)
 *
 * The single copy-status surface. `borrowed`/`held` are circulation-owned and
 * are rejected by the RPC; `found` resolves a lost copy to available.
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

  const copyId = requiredString(body.copy_id ?? body.copyId)
  const targetStatus = requiredString(body.target_status ?? body.targetStatus)
  const reason = requiredString(body.reason)

  if (!copyId) return fail('VALIDATION_FAILED', 'Missing required parameter: copy_id')
  if (!targetStatus) return fail('VALIDATION_FAILED', 'Missing required parameter: target_status')
  if (!reason) return fail('VALIDATION_FAILED', 'A mandatory reason is required for a status change')

  const shelf = requiredString(body.shelf_location ?? body.shelfLocation)

  return runInventoryRpc(
    auth.supabaseAdmin,
    'rpc_change_copy_status',
    {
      p_actor_id: auth.user.id,
      p_copy_id: copyId,
      p_target_status: targetStatus,
      p_reason: reason,
      p_shelf_location: shelf,
    },
    'Copy status updated and logged.',
  )
})
