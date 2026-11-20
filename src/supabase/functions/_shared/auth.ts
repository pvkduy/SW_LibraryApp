import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fail } from './http.ts'

export async function requireAdmin(req: Request) {
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

  const role = user.app_metadata?.role
  if (role !== 'admin') {
    return { errorResponse: fail('FORBIDDEN_ROLE', 'Librarian (admin) role required to execute circulation actions') }
  }

  return { user, supabaseAdmin }
}
