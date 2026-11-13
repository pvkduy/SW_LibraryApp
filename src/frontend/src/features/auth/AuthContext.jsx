import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Listen for session and auth changes
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession?.user) {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Load the caller's profile row whenever session user ID changes
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return

    let active = true
    supabase
      .from('profiles')
      .select('id, role, status, full_name, email, student_id, faculty, phone, avatar_path')
      .eq('id', uid)
      .single()
      .then(({ data, error }) => {
        if (active && !error) setProfile(data)
      })

    return () => {
      active = false
    }
  }, [session?.user?.id])

  const refreshProfile = async () => {
    const uid = session?.user?.id
    if (!uid) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, status, full_name, email, student_id, faculty, phone, avatar_path')
      .eq('id', uid)
      .single()
    if (!error && data) {
      setProfile(data)
      return data
    }
    return null
  }

  // Register via Edge Function (FR-AUTH-01, EC-36) with client fallback for local dev
  const registerStudent = async (registrationData) => {
    try {
      return await api.invoke('register-student', registrationData)
    } catch (err) {
      // If Edge Function is not served locally, fall back to direct Supabase Auth signUp
      console.warn('Edge function register-student unavailable, falling back to direct auth.signUp:', err)
      const res = await supabase.auth.signUp({
        email: registrationData.email,
        password: registrationData.password,
        options: {
          data: {
            full_name: registrationData.fullName,
            student_id: registrationData.studentId,
          },
        },
      })
      if (res.error) throw res.error
      return res.data
    }
  }

  // Sign in with credentials (FR-AUTH-03)
  const loginWithEmail = async (email, password) => {
    const res = await supabase.auth.signInWithPassword({ email, password })
    if (res.error) throw res.error
    return res.data
  }

  // Verify 6-digit OTP code (FR-AUTH-02)
  const verifyOtp = async (email, token, type = 'signup') => {
    const res = await supabase.auth.verifyOtp({ email, token, type })
    if (res.error) throw res.error
    await refreshProfile()
    return res.data
  }

  // Resend OTP code
  const resendOtp = async (email, type = 'signup') => {
    const res = await supabase.auth.resend({ type, email })
    if (res.error) throw res.error
    return res.data
  }

  // Request password reset email (FR-AUTH-04)
  const resetPassword = async (email) => {
    const res = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (res.error) throw res.error
    return res.data
  }

  // Update password with new password (FR-AUTH-04)
  const updatePassword = async (newPassword) => {
    const res = await supabase.auth.updateUser({ password: newPassword })
    if (res.error) throw res.error
    return res.data
  }

  // Sign out (FR-AUTH-03)
  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        registerStudent,
        loginWithEmail,
        verifyOtp,
        resendOtp,
        resetPassword,
        updatePassword,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
