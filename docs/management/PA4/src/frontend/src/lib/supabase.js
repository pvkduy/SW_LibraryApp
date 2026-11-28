import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY ' +
      'in src/frontend/.env.local (see src/frontend/.env.example).',
  )
}

/**
 * Browser Supabase client.
 *
 * Only the anon key is used here. It is safe in the browser because every table
 * is protected by Row Level Security. The service_role key must never appear in
 * client code (SRS NFR-06); privileged writes go through Edge Functions.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
