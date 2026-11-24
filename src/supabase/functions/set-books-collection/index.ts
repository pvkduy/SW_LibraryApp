/**
 * Edge Function: set-books-collection (FR-INV-03, UC-19)
 *
 * Bulk collection-tier change for selected catalog rows. Existing loans keep
 * their stored fee; only future checkouts see the new tier.
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

  const bookIds = body.book_ids ?? body.bookIds
  const collection = body.collection

  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    return fail('VALIDATION_FAILED', 'Select at least one book')
  }
  if (collection !== 'standard' && collection !== 'premium') {
    return fail('VALIDATION_FAILED', 'Collection must be standard or premium')
  }

  return runInventoryRpc(
    auth.supabaseAdmin,
    'rpc_set_books_collection',
    { p_actor_id: auth.user.id, p_book_ids: bookIds, p_collection: collection },
    `Collection set to ${collection} for ${bookIds.length} selected title(s).`,
  )
})
