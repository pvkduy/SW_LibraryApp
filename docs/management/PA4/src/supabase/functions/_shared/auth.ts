import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fail } from './http.ts'

export async function authenticate(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321'
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!serviceRoleKey) {
    return { errorResponse: fail('INTERNAL', 'Server configuration error: missing service role key') }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (!authHeader) {
    return { errorResponse: fail('UNAUTHENTICATED', 'Missing Authorization header') }
  }

  const supabaseUser = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return { errorResponse: fail('UNAUTHENTICATED', authError?.message || 'Invalid authorization token') }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { errorResponse: fail('INTERNAL', 'Failed to verify account status') }
  }
  if (!profile) {
    return { errorResponse: fail('UNAUTHENTICATED', 'Account profile not found') }
  }

  return { user, profile, supabaseAdmin }
}

export async function requireUser(req: Request, allowedStatuses = ['active']) {
  const auth = await authenticate(req)
  if (auth.errorResponse) return auth

  if (auth.profile.role !== 'student' || auth.user.app_metadata?.role !== 'student') {
    return { errorResponse: fail('FORBIDDEN_ROLE', 'Student role required') }
  }
  if (!allowedStatuses.includes(auth.profile.status)) {
    return {
      errorResponse: fail(
        auth.profile.status === 'restricted' ? 'ACCOUNT_RESTRICTED' : 'ACCOUNT_NOT_ACTIVE',
        `Account is not eligible for this action (${auth.profile.status}).`,
      ),
    }
  }

  return auth
}

export async function requireAdmin(req: Request) {
  const auth = await authenticate(req)
  if (auth.errorResponse) return auth

  if (auth.profile.role !== 'admin' || auth.user.app_metadata?.role !== 'admin') {
    return { errorResponse: fail('FORBIDDEN_ROLE', 'Librarian (admin) role required to execute circulation actions') }
  }
  if (auth.profile.status !== 'active') {
    return { errorResponse: fail('ACCOUNT_NOT_ACTIVE', 'An active admin account is required') }
  }

  return auth
}
