import { requireUser } from '../_shared/auth.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireUser(req)
  if (auth.errorResponse) return auth.errorResponse

  let body: { book_id?: string }
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }
  if (!body.book_id) return fail('VALIDATION_FAILED', 'Missing book_id')

  const { data, error } = await auth.supabaseAdmin.rpc('rpc_reserve_book_for_user', {
    p_user_id: auth.user.id,
    p_book_id: body.book_id,
  })
  if (error) return fail('INTERNAL', error.message)
  if (!data?.success) {
    const message = data?.message || 'Could not place reservation.'
    switch (data?.reason) {
      case 'ACCOUNT_RESTRICTED':
        return fail('ACCOUNT_RESTRICTED', message)
      case 'ACCOUNT_NOT_ACTIVE':
        return fail('ACCOUNT_NOT_ACTIVE', message)
      case 'DEBT_HOLD':
        return fail('DEBT_HOLD', message)
      case 'NOT_FOUND':
        return fail('NOT_FOUND', message)
      case 'DUPLICATE':
        return fail('DUPLICATE', message)
      case 'QUEUE_FULL':
        return fail('QUEUE_FULL', message)
      default:
        return fail('VALIDATION_FAILED', message)
    }
  }

  return json(data)
})
