import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Load the caller's profile row once we have a session.
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return

    let active = true
    supabase
      .from('profiles')
      .select('id, role, status, full_name, email, student_id, faculty, avatar_path')
      .eq('id', uid)
      .single()
      .then(({ data, error }) => {
        if (active && !error) setProfile(data)
      })

    return () => {
      active = false
    }
  }, [session?.user?.id])

  const loginWithEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const registerWithEmail = (email, password) =>
    supabase.auth.signUp({ email, password })

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
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
