import { useEffect, useState } from 'react'
import '../App.css'
import '../features/auth/auth.css'
import { useAuth } from '../features/auth/AuthContext.jsx'
import { LoginPage } from '../features/auth/LoginPage.jsx'
import { RegisterPage } from '../features/auth/RegisterPage.jsx'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage.jsx'
import { VerifyOtpPage } from '../features/auth/VerifyOtpPage.jsx'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.jsx'
import { AuthSuccessModal, AuthErrorModal, AuthConfirmModal } from '../features/auth/components/AuthModals.jsx'
import { supabase } from '../lib/supabase'
import { AdminLayout } from '../features/admin/components/AdminLayout.jsx'
import { CirculationPage } from '../features/admin/circulation/CirculationPage.jsx'
import { QueuesPage } from '../features/admin/queues/QueuesPage.jsx'
import { FinancialLedgerPage } from '../features/admin/ledger/FinancialLedgerPage.jsx'
import { ReaderLayout } from '../features/reader/components/ReaderLayout.jsx'
import { LoansPage } from '../features/reader/loans/LoansPage.jsx'
import { FinesPage } from '../features/reader/fines/FinesPage.jsx'
import { ReservationsPage } from '../features/reader/reservations/ReservationsPage.jsx'

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [adminPage, setAdminPage] = useState('circulation')
  const [readerTab, setReaderTab] = useState('books')

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

    // 1A. Admin Experience (Circulation & Queues)
    if (profile?.role === 'admin') {
      return (
        <>
          <AdminLayout
            activePage={adminPage}
            onNavigate={(page) => setAdminPage(page)}
            user={user}
            profile={profile}
            onLogout={() => setShowLogoutConfirm(true)}
          >
            {adminPage === 'circulation' && <CirculationPage />}
            {adminPage === 'queues' && <QueuesPage />}
            {adminPage === 'money' && <FinancialLedgerPage />}
            {adminPage !== 'circulation' && adminPage !== 'queues' && adminPage !== 'money' && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#72685e' }}>
                <h2 style={{ color: '#241e19' }}>Màn hình {adminPage.toUpperCase()} đang được phát triển</h2>
                <p>Vui lòng chọn <strong>Circulation</strong>, <strong>Queues & Holds</strong> hoặc <strong>Money</strong> ở menu bên trái.</p>
              </div>
            )}
          </AdminLayout>

          {showLogoutConfirm && (
            <AuthConfirmModal
              title="Xác nhận đăng xuất"
              subtitle="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?"
              confirmText="Đăng xuất"
              cancelText="Không, ở lại"
              onConfirm={() => {
                setShowLogoutConfirm(false)
                logout()
              }}
              onCancel={() => setShowLogoutConfirm(false)}
            />
          )}
        </>
      )
    }

    // 1B. Student / Reader Experience (Matching Figma Reader Mockups)
    return (
      <ReaderLayout
        activeTab={readerTab}
        onSelectTab={(tab) => setReaderTab(tab)}
        user={user}
        profile={profile}
        onLogout={() => setShowLogoutConfirm(true)}
      >
        {readerTab === 'loans' && <LoansPage />}
        {readerTab === 'fines' && <FinesPage onProfileRefresh={() => window.location.reload()} />}
        {readerTab === 'reservations' && <ReservationsPage />}
        {readerTab === 'books' && (
          <section>
            <h2 style={{ fontSize: '20px', color: '#221c18', marginBottom: '16px' }}>Danh sách sách trong thư viện</h2>
            {error && <p className="error">{error}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {books.map((book) => (
                <div key={book.id} style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #ede6db', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#2a2421' }}>
                      {book.title}
                      {book.collection === 'premium' && (
                        <span style={{ marginLeft: '8px', color: '#6e472a', fontWeight: 600, fontSize: '11px', background: '#f5eee6', padding: '2px 6px', borderRadius: '4px' }}>
                          Premium
                        </span>
                      )}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6e665e' }}>{book.authors?.join(', ')}</p>
                  </div>
                  <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#8c827a' }}>
                      Bản có sẵn: <strong>{book.available_copies}</strong>
                    </span>
                    <button
                      type="button"
                      className="auth-btn-primary"
                      style={{ width: 'auto', padding: '0 12px', height: '30px', fontSize: '12px', marginTop: 0 }}
                      onClick={() => setReaderTab('loans')}
                    >
                      Mượn / Đặt trước
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!error && books.length === 0 && <p style={{ color: '#6e665e' }}>Chưa có sách nào trong thư viện.</p>}
          </section>
        )}

        {showLogoutConfirm && (
          <AuthConfirmModal
            title="Xác nhận đăng xuất"
            subtitle="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?"
            confirmText="Đăng xuất"
            cancelText="Không, ở lại"
            onConfirm={() => {
              setShowLogoutConfirm(false)
              logout()
            }}
            onCancel={() => setShowLogoutConfirm(false)}
          />
        )}
      </ReaderLayout>
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
