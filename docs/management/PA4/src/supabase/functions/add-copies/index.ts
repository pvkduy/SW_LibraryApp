/**
 * Edge Function: add-copies (FR-INV-01, UC-19 §2.2.2)
 *
 * Adds physical copies to an existing title, generating unique barcodes and
 * `manual_addition` inventory transactions.
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

  const bookId = requiredString(body.book_id ?? body.bookId)
  if (!bookId) return fail('VALIDATION_FAILED', 'Missing required parameter: book_id')

  const copies = body.copies
  if (!Array.isArray(copies) || copies.length === 0) {
    return fail('VALIDATION_FAILED', 'At least one copy is required')
  }
  if (copies.length > 100) {
    return fail('VALIDATION_FAILED', 'At most 100 copies can be added at once')
  }

  const reason = requiredString(body.reason) ?? 'Copies added to existing title'

  return runInventoryRpc(
    auth.supabaseAdmin,
    'rpc_add_copies',
    { p_actor_id: auth.user.id, p_book_id: bookId, p_copies: copies, p_reason: reason },
    `${copies.length} copy record(s) created.`,
  )
})
