import { requireUser } from '../_shared/auth.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireUser(req, ['active', 'restricted'])
  if (auth.errorResponse) return auth.errorResponse

  let body: { loan_item_id?: string; rating?: number; comment?: string | null; headline?: string | null }
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }
  if (!body.loan_item_id || !Number.isInteger(body.rating)) {
    return fail('VALIDATION_FAILED', 'loan_item_id and an integer rating are required')
  }

  const { data, error } = await auth.supabaseAdmin.rpc('rpc_submit_book_review_for_user', {
    p_user_id: auth.user.id,
    p_loan_item_id: body.loan_item_id,
    p_rating: body.rating,
    p_comment: body.comment ?? null,
    p_headline: body.headline ?? null,
  })
  if (error) return fail('INTERNAL', error.message)
  if (!data?.success) {
    const reason = data?.error === 'NOT_FOUND' || data?.error === 'FORBIDDEN'
      ? 'NOT_FOUND'
      : data?.error === 'NOT_RETURNED'
        ? 'PRECONDITION_FAILED'
        : 'VALIDATION_FAILED'
    return fail(reason, data?.message || 'Review could not be submitted.')
  }

  return json(data)
})
