import { requireUser } from '../_shared/auth.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireUser(req, ['active', 'restricted'])
  if (auth.errorResponse) return auth.errorResponse

  let body: { book_id?: string }
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }
  if (!body.book_id) return fail('VALIDATION_FAILED', 'Missing book_id')

  const { data, error } = await auth.supabaseAdmin.rpc('rpc_toggle_wishlist_for_user', {
    p_user_id: auth.user.id,
    p_book_id: body.book_id,
  })
  if (error) return fail('INTERNAL', error.message)
  if (!data?.success) {
    const reason = data?.reason === 'WISHLIST_FULL' ? 'WISHLIST_FULL' : 'VALIDATION_FAILED'
    return fail(reason, data?.message || 'Could not update wishlist.')
  }

  return json(data)
})
