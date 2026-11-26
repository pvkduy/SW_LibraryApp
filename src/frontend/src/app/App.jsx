import { useState } from 'react'
import '../App.css'
import '../features/auth/auth.css'
import { useAuth } from '../features/auth/AuthContext.jsx'
import { LoginPage } from '../features/auth/LoginPage.jsx'
import { RegisterPage } from '../features/auth/RegisterPage.jsx'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage.jsx'
import { VerifyOtpPage } from '../features/auth/VerifyOtpPage.jsx'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.jsx'
import { AuthSuccessModal, AuthErrorModal, AuthConfirmModal } from '../features/auth/components/AuthModals.jsx'
import { AdminLayout } from '../features/admin/components/AdminLayout.jsx'
import { CirculationPage } from '../features/admin/circulation/CirculationPage.jsx'
import { QueuesPage } from '../features/admin/queues/QueuesPage.jsx'
import { FinancialLedgerPage } from '../features/admin/ledger/FinancialLedgerPage.jsx'
import { AdminBooksPage } from '../features/admin/books/AdminBooksPage.jsx'
import { ReaderLayout } from '../features/reader/components/ReaderLayout.jsx'
import { LoansPage } from '../features/reader/loans/LoansPage.jsx'
import { FinesPage } from '../features/reader/fines/FinesPage.jsx'
import { ReservationsPage } from '../features/reader/reservations/ReservationsPage.jsx'
import { CartProvider } from '../features/reader/catalog/CartProvider.jsx'
import { useCart } from '../features/reader/catalog/useCart.js'
import { CataloguePage } from '../features/reader/catalog/CataloguePage.jsx'
import { ScanIsbnPage } from '../features/reader/catalog/ScanIsbnPage.jsx'
import { BookDetailPage } from '../features/reader/catalog/BookDetailPage.jsx'
import { CheckoutFlowPage } from '../features/reader/catalog/CheckoutFlowPage.jsx'

function getInitialRoute() {
  if (typeof window === 'undefined') return 'login'
  const path = window.location.pathname.replace(/^\//, '')
  if (['login', 'register', 'forgot-password', 'reset-password', 'verify-email'].includes(path)) {
    return path === 'verify-email' ? 'verify-otp' : path
  }
  return 'login'
}

function ReaderWorkspace({ user, profile, onRequestLogout }) {
  const { cartCount, wishlistIds, activeLoansCount, maxItems } = useCart()
  const [readerTab, setReaderTab] = useState('books')
  const [readerScreen, setReaderScreen] = useState('main') // 'main' | 'scan' | 'book-detail' | 'checkout'
  const [selectedBookId, setSelectedBookId] = useState(null)

  const openBook = (bookId) => {
    setSelectedBookId(bookId)
    setReaderScreen('book-detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openMainTab = (tab) => {
    setReaderTab(tab)
    setReaderScreen('main')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (readerScreen === 'scan') {
    return (
      <ScanIsbnPage
        onBack={() => setReaderScreen('main')}
        onBookFound={(bookId) => openBook(bookId)}
      />
    )
  }

  if (readerScreen === 'book-detail' && selectedBookId) {
    return (
      <BookDetailPage
        bookId={selectedBookId}
        profile={profile}
        onBack={() => setReaderScreen('main')}
        onOpenCart={() => setReaderScreen('checkout')}
        onNavigateLoans={() => openMainTab('loans')}
      />
    )
  }

  if (readerScreen === 'checkout') {
    return (
      <CheckoutFlowPage
        profile={profile}
        user={user}
        onBackToCatalog={() => openMainTab('books')}
        onGoToLoans={() => openMainTab('loans')}
      />
    )
  }

  return (
    <ReaderLayout
      activeTab={readerTab}
      onSelectTab={openMainTab}
      profile={profile}
      cartCount={cartCount}
      wishlistCount={wishlistIds.length}
      onOpenCart={() => setReaderScreen('checkout')}
    >
      {readerTab === 'books' && (
        <CataloguePage
          profile={profile}
          mode="discover"
          onOpenBook={openBook}
          onOpenScan={() => setReaderScreen('scan')}
        />
      )}

      {readerTab === 'wishlist' && (
        <CataloguePage
          profile={profile}
          mode="wishlist"
          onOpenBook={openBook}
          onOpenScan={() => setReaderScreen('scan')}
        />
      )}

      {readerTab === 'loans' && (
        <div className="sh-container my-loans-container">
          <LoansPage
            maxItems={maxItems}
            profile={profile}
            onProfileRefresh={() => window.location.reload()}
          />
        </div>
      )}

      {readerTab === 'fines' && (
        <div className="sh-container">
          <FinesPage profile={profile} onProfileRefresh={() => window.location.reload()} />
        </div>
      )}

      {readerTab === 'reservations' && (
        <div className="sh-container">
          <ReservationsPage />
        </div>
      )}

      {readerTab === 'profile' && (
        <div className="sh-container sh-container-narrow">
          <div className="sh-card">
            <h2 style={{ margin: '0 0 14px', fontSize: '19px', color: '#241e19' }}>Patron Profile</h2>
            <div className="sh-pub-grid" style={{ marginBottom: '16px' }}>
              <div className="sh-pub-item">
                <small>Full Name</small>
                <strong>{profile?.full_name || 'Student Reader'}</strong>
              </div>
              <div className="sh-pub-item">
                <small>Student ID</small>
                <strong>{profile?.student_id || 'N/A'}</strong>
              </div>
              <div className="sh-pub-item">
                <small>Email</small>
                <strong>{profile?.email || user?.email}</strong>
              </div>
              <div className="sh-pub-item">
                <small>Faculty</small>
                <strong>{profile?.faculty || 'VNUHCM-US'}</strong>
              </div>
              <div className="sh-pub-item">
                <small>Borrowing Quota</small>
                <strong>
                  {activeLoansCount} / {maxItems} Active Items
                </strong>
              </div>
              <div className="sh-pub-item">
                <small>Outstanding Debt</small>
                <strong style={{ color: (profile?.debt_outstanding || 0) > 0 ? '#c5221f' : '#2e6930' }}>
                  {(profile?.debt_outstanding || 0).toLocaleString('vi-VN')}₫
                </strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="sh-btn-outline" style={{ flex: 1 }} onClick={() => openMainTab('reservations')}>
                Reservations
              </button>
              <button type="button" className="sh-btn-outline" style={{ flex: 1 }} onClick={() => openMainTab('fines')}>
                Payment History &amp; Fines
              </button>
              <button
                type="button"
                className="sh-btn-primary"
                style={{ width: '100%', background: '#c85a3e' }}
                onClick={onRequestLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </ReaderLayout>
  )
}

function App() {
  const { user, profile, loading, logout } = useAuth()
  const [currentRoute, setCurrentRoute] = useState(getInitialRoute)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [adminPage, setAdminPage] = useState('circulation')

  const navigate = (route, params = {}) => {
    if (params.email) setRegisteredEmail(params.email)
    setCurrentRoute(route)
    window.history.pushState({}, '', `/${route}`)
  }

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

    // 1A. Admin Experience (Books, Circulation, Queues, Money)
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
            {adminPage === 'books' && <AdminBooksPage />}
            {adminPage === 'circulation' && <CirculationPage />}
            {adminPage === 'queues' && <QueuesPage />}
            {adminPage === 'money' && <FinancialLedgerPage />}
            {!['books', 'circulation', 'queues', 'money'].includes(adminPage) && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#72685e' }}>
                <h2 style={{ color: '#241e19' }}>Màn hình {adminPage.toUpperCase()} đang được phát triển</h2>
                <p>
                  Vui lòng chọn <strong>Books</strong>, <strong>Circulation</strong>, <strong>Queues &amp; Holds</strong> hoặc{' '}
                  <strong>Money</strong> ở menu bên trái.
                </p>
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

    // 1B. Student / Reader Experience (Figma 002 Catalog/Detail/Scan + 004 Cart/Checkout)
    return (
      <CartProvider user={user}>
        <ReaderWorkspace
          user={user}
          profile={profile}
          onRequestLogout={() => setShowLogoutConfirm(true)}
        />

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
      </CartProvider>
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
