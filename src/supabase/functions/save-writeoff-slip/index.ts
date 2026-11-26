/**
 * Edge Function: save-writeoff-slip (FR-COND-02/03, UC-22)
 *
 * Creates or updates a draft slip, replacing its staged copies. Saving a draft
 * never changes copy statuses or writes inventory transactions.
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

  const reasonCode = requiredString(body.reason_code ?? body.reasonCode) ??
    'damaged_beyond_repair'

  const copies = Array.isArray(body.copies) ? body.copies : []
  if (copies.length > 500) {
    return fail('VALIDATION_FAILED', 'A slip can stage at most 500 copies')
  }

  const photos = Array.isArray(body.photos) ? body.photos.filter((p: unknown) => typeof p === 'string') : []

  return runInventoryRpc(
    auth.supabaseAdmin,
    'rpc_save_writeoff_slip',
    {
      p_actor_id: auth.user.id,
      p_slip_id: requiredString(body.slip_id ?? body.slipId),
      p_reason_code: reasonCode,
      p_notes: typeof body.notes === 'string' ? body.notes : null,
      p_copies: copies,
      p_photos: photos,
    },
    'Write-off slip saved as draft.',
  )
})
