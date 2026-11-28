/**
 * Edge Function: import-books (FR-INV-02, UC-19 §2.2.3)
 *
 * Receives already-parsed, alias-normalized CSV rows from the browser. The RPC
 * validates every row again server-side, imports valid rows, and reports only
 * the erroneous row numbers and reasons.
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

  const rows = body.rows
  const duplicateRule = body.duplicate_rule ?? body.duplicateRule ?? 'skip'

  if (!Array.isArray(rows)) {
    return fail('VALIDATION_FAILED', 'Missing required parameter: rows')
  }
  if (rows.length > 1000) {
    return fail('VALIDATION_FAILED', 'CSV files are limited to 1,000 rows')
  }
  if (!['skip', 'add_copies', 'update_metadata'].includes(duplicateRule)) {
    return fail('VALIDATION_FAILED', 'Duplicate rule must be skip, add_copies, or update_metadata')
  }

  return runInventoryRpc(
    auth.supabaseAdmin,
    'rpc_import_books',
    { p_actor_id: auth.user.id, p_rows: rows, p_duplicate_rule: duplicateRule },
    'Import finished.',
  )
})
