import { requireUser } from '../_shared/auth.ts'
import { fail, handleOptions, json } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireUser(req, ['active', 'restricted'])
  if (auth.errorResponse) return auth.errorResponse

  let body: { charge_ids?: string[]; method?: string }
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }
  if (!Array.isArray(body.charge_ids) || body.charge_ids.length === 0) {
    return fail('VALIDATION_FAILED', 'Select at least one charge')
  }

  const { data, error } = await auth.supabaseAdmin.rpc('rpc_pay_reader_charges_for_user', {
    p_user_id: auth.user.id,
    p_charge_ids: body.charge_ids,
    p_method: body.method || 'online',
  })
  if (error) return fail('INTERNAL', error.message)
  if (!data?.success) {
    const message = data?.error === 'NO_CHARGES_SELECTED'
      ? 'Select at least one charge to pay.'
      : data?.error === 'NO_PAYABLE_CHARGES'
        ? 'No selected charges are currently payable.'
        : 'Payment could not be completed.'
    return fail('VALIDATION_FAILED', message)
  }

  return json(data)
})
