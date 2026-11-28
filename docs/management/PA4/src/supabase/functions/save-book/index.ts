/**
 * Edge Function: save-book (FR-INV-01 / FR-INV-03, UC-19)
 *
 * Creates a new title or edits an existing title and optionally creates the
 * initial physical copies. The PostgreSQL RPC owns validation and transactions
 * so the write is atomic and auditable.
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

  const book = body.book ?? body
  if (!book || typeof book !== 'object') {
    return fail('VALIDATION_FAILED', 'Missing required parameter: book')
  }
  if (typeof book.title !== 'string' || book.title.trim() === '') {
    return fail('VALIDATION_FAILED', 'Title is required')
  }

  const copies = Array.isArray(body.copies) ? body.copies : []
  if (copies.length > 100) {
    return fail('VALIDATION_FAILED', 'At most 100 copies can be created at once')
  }

  return runInventoryRpc(
    auth.supabaseAdmin,
    'rpc_save_book',
    { p_actor_id: auth.user.id, p_book: book, p_copies: copies },
    book.id ? 'Book updated successfully.' : 'Book registered successfully.',
  )
})
