/**
 * Edge Function: inventory-history (FR-INV-06, UC-26)
 *
 * Returns one page of the immutable inventory transaction log plus the total
 * matching count. Filters mirror the A-14 quick filters and search box.
 */
import { fail, handleOptions } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'
import { runInventoryRpc } from '../_shared/inventory-rpc.ts'

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

  const limit = Number(body.limit ?? 50)
  const offset = Number(body.offset ?? 0)
  if (!Number.isFinite(limit) || !Number.isFinite(offset)) {
    return fail('VALIDATION_FAILED', 'limit and offset must be numbers')
  }

  return runInventoryRpc(auth.supabaseAdmin, 'rpc_inventory_history', {
    p_actor_id: auth.user.id,
    p_q: typeof body.q === 'string' && body.q.trim() ? body.q.trim() : null,
    p_type_group: typeof body.type_group === 'string' && body.type_group ? body.type_group : 'all',
    p_start: typeof body.start === 'string' && body.start ? body.start : null,
    p_end: typeof body.end === 'string' && body.end ? body.end : null,
    p_limit: Math.min(Math.max(Math.trunc(limit), 1), 20000),
    p_offset: Math.max(Math.trunc(offset), 0),
  })
})
