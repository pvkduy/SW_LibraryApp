/**
 * Edge Function: register-student
 *
 * Implements FR-AUTH-01 (SRS §3.1, §10.1, EC-36).
 * Creates Auth user with role 'student' and profile row (status=pending_verification).
 * Rolls back (deletes Auth user) if profile creation fails.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fail, handleOptions, json } from '../_shared/http.ts'
import { validateStudentRegistration } from '../../../shared/src/domain/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()

  if (req.method !== 'POST') {
    return fail('VALIDATION_FAILED', 'Method must be POST')
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }

  const validation = validateStudentRegistration({
    fullName: body.fullName || body.full_name,
    email: body.email,
    studentId: body.studentId || body.student_id,
    password: body.password,
    confirmPassword: body.confirmPassword || body.confirm_password,
    faculty: body.faculty,
    phone: body.phone,
  })

  if (!validation.valid) {
    return fail('VALIDATION_FAILED', 'Validation failed', validation.errors)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321'
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!serviceRoleKey) {
    return fail('INTERNAL', 'Server configuration error: missing service role key')
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = (body.email as string).trim().toLowerCase()
  const studentId = (body.studentId || body.student_id as string).trim()
  const fullName = (body.fullName || body.full_name as string).trim()
  const faculty = body.faculty ? (body.faculty as string).trim() : null
  const phone = body.phone ? (body.phone as string).trim() : null

  // Check duplicate email or student_id in profiles
  const { data: existingProfiles, error: checkError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, student_id')
    .or(`email.ilike.${email},student_id.eq.${studentId}`)
    .limit(1)

  if (checkError) {
    return fail('INTERNAL', 'Failed to verify existing accounts', checkError.message)
  }

  if (existingProfiles && existingProfiles.length > 0) {
    const conflictField = existingProfiles[0].student_id === studentId ? 'studentId' : 'email'
    return fail(
      'DUPLICATE',
      conflictField === 'studentId'
        ? 'Student ID already registered'
        : 'Email already registered, please log in or reset password',
      { field: conflictField }
    )
  }

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: false,
    app_metadata: { role: 'student' },
    user_metadata: { full_name: fullName, student_id: studentId },
  })

  if (authError || !authData.user) {
    return fail('INTERNAL', authError?.message || 'Failed to create auth user')
  }

  const userId = authData.user.id

  // 2. Insert into profiles with pending_verification
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userId,
    role: 'student',
    status: 'pending_verification',
    full_name: fullName,
    email,
    student_id: studentId,
    faculty,
    phone,
  })

  // Atomic Rollback (EC-36): If profile creation fails, delete the created auth user
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return fail('INTERNAL', 'Failed to initialize profile record. Rolled back.', profileError.message)
  }

  return json({
    success: true,
    message: 'Registration successful. Please verify your email with the verification code.',
    userId,
    status: 'pending_verification',
  })
})
