import { useEffect, useState } from 'react'
import '../App.css'
import '../features/auth/auth.css'
import { useAuth } from '../features/auth/AuthContext.jsx'
import { LoginPage } from '../features/auth/LoginPage.jsx'
import { RegisterPage } from '../features/auth/RegisterPage.jsx'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage.jsx'
import { VerifyOtpPage } from '../features/auth/VerifyOtpPage.jsx'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.jsx'
import { AuthSuccessModal, AuthErrorModal } from '../features/auth/components/AuthModals.jsx'
import { supabase } from '../lib/supabase'

function getInitialRoute() {
  if (typeof window === 'undefined') return 'login'
  const path = window.location.pathname.replace(/^\//, '')
  if (['login', 'register', 'forgot-password', 'reset-password', 'verify-email'].includes(path)) {
    return path === 'verify-email' ? 'verify-otp' : path
  }
  return 'login'
}

function App() {
  const { user, profile, loading, logout } = useAuth()
  const [currentRoute, setCurrentRoute] = useState(getInitialRoute)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [books, setBooks] = useState([])
  const [error, setError] = useState(null)

  const navigate = (route, params = {}) => {
    if (params.email) setRegisteredEmail(params.email)
    setCurrentRoute(route)
    window.history.pushState({}, '', `/${route}`)
  }

  // Load books when authenticated
  useEffect(() => {
    if (!user) return

    let active = true
    supabase
      .from('books')
      .select('id, title, authors, collection, available_copies')
      .eq('status', 'active')
      .order('added_at', { ascending: false })
      .limit(20)
      .then(({ data, error: err }) => {
        if (!active) return
        if (err) setError(err.message)
        else setBooks(data ?? [])
      })

    return () => {
      active = false
    }
  }, [user])

  if (loading) {
    return (
      <div className="auth-viewport" style={{ alignItems: 'center' }}>
        <p style={{ color: '#6e665e', fontWeight: 500 }}>Đang tải ShelfHelp...</p>
      </div>
    )
  }

  // 1. Authenticated User Experience (FR-AUTH-03 & Role Routing)
  if (user) {
    // If user's account is pending verification, gate to verification screen (FR-AUTH-02)
    if (profile?.status === 'pending_verification') {
      return (
        <VerifyOtpPage
          email={profile.email || user.email}
          onNavigate={navigate}
          onVerified={() => navigate('success')}
        />
      )
    }

    // Authenticated Home / Dashboard View
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#faf8f5', fontFamily: 'inherit' }}>
        {/* Status banner for Restricted accounts (FR-GLOB-01, POL-09) */}
        {profile?.status === 'restricted' && (
          <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '12px 16px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #ffeeba' }}>
            ⚠️ Account Restricted: Your account has an unresolved loss or restriction. Please settle any fees or contact the librarian.
          </div>
        )}

        <main className="app" style={{ maxWidth: '840px', margin: '0 auto', padding: '24px 16px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #ede6db' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', color: '#221c18' }}>ShelfHelp Library</h1>
              <span style={{ fontSize: '13px', color: '#6e665e' }}>
                Mode: {profile?.role === 'admin' ? 'Admin Mode (Librarian)' : 'Reader Mode (Student)'}
              </span>
            </div>

            <div className="user" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 600, color: '#2a2421', fontSize: '14px' }}>
                {profile?.full_name || user.email}
              </span>
              <button
                type="button"
                className="auth-btn-primary"
                style={{ width: 'auto', height: '36px', padding: '0 16px', marginTop: 0, fontSize: '13px' }}
                onClick={logout}
              >
                Đăng xuất
              </button>
            </div>
          </header>

          <section style={{ marginTop: '24px' }}>
            <h2 style={{ fontSize: '18px', color: '#221c18', marginBottom: '16px' }}>Danh sách sách mới trong thư viện</h2>
            {error && <p className="error">{error}</p>}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {books.map((book) => (
                <li key={book.id} style={{ padding: '12px 16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #ede6db', marginBottom: '8px' }}>
                  <strong style={{ color: '#2a2421' }}>{book.title}</strong> — <span style={{ color: '#6e665e' }}>{book.authors?.join(', ')}</span>
                  {book.collection === 'premium' && <span style={{ marginLeft: '8px', color: '#6e472a', fontWeight: 600, fontSize: '12px' }}>(Premium)</span>}
                  <div style={{ fontSize: '12px', color: '#8c827a', marginTop: '4px' }}>
                    Có sẵn: {book.available_copies} bản
                  </div>
                </li>
              ))}
            </ul>
            {!error && books.length === 0 && <p style={{ color: '#6e665e' }}>Chưa có sách nào trong thư viện.</p>}
          </section>
        </main>
      </div>
    )
  }

  // 2. Unauthenticated Auth Flows (Matching 8 Figma Mockups)
  switch (currentRoute) {
    case 'register':
      return (
        <RegisterPage
          onNavigate={navigate}
          onRegistered={(em) => navigate('verify-otp', { email: em })}
        />
      )

    case 'forgot-password':
      return <ForgotPasswordPage onNavigate={navigate} />

    case 'verify-otp':
      return (
        <VerifyOtpPage
          email={registeredEmail || user?.email || ''}
          onNavigate={navigate}
          onVerified={() => navigate('success')}
        />
      )

    case 'reset-password':
      return <ResetPasswordPage onNavigate={navigate} />

    case 'success':
      return (
        <AuthSuccessModal
          title="Registration Completed"
          subtitle="Welcome to ShelfHelp!"
          buttonText="Back to Home"
          onAction={() => navigate('login')}
        />
      )

    case 'error':
      return (
        <AuthErrorModal
          title="Something went wrong"
          subtitle="Please try again later"
          buttonText="Try Again"
          onAction={() => navigate('login')}
        />
      )

    case 'login':
    default:
      return <LoginPage onNavigate={navigate} />
  }
}

export default App
