import { requireUser } from '../_shared/auth.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireUser(req)
  if (auth.errorResponse) return auth.errorResponse

  let body: { loan_item_id?: string }
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }
  if (!body.loan_item_id) return fail('VALIDATION_FAILED', 'Missing loan_item_id')

  const { data, error } = await auth.supabaseAdmin.rpc('rpc_renew_loan_for_user', {
    p_user_id: auth.user.id,
    p_loan_item_id: body.loan_item_id,
  })
  if (error) return fail('INTERNAL', error.message)
  if (!data?.success) {
    if (data?.error === 'LOAN_NOT_FOUND' || data?.error === 'FORBIDDEN') {
      return fail('NOT_FOUND', 'Loan record not found.')
    }
    const message = data?.error === 'INVALID_STATUS'
      ? 'Only borrowed loans can be renewed.'
      : data?.error === 'RENEWAL_LIMIT_REACHED'
        ? 'The renewal limit has been reached.'
        : data?.error === 'RESERVATION_HOLD'
          ? 'This book cannot be renewed while another reader is waiting.'
          : 'Renewal is not allowed.'
    return fail('RENEWAL_NOT_ALLOWED', message)
  }

  return json(data)
})
