import './reader.css'
import '../catalog/catalog.css'
import {
  BellIcon,
  CartIcon,
  HeartIcon,
  LoansNavIcon,
  SearchIcon,
  ShelfBookLogo,
  UserNavIcon,
} from '../catalog/CatalogIcons'

export function ReaderLayout({
  activeTab,
  onSelectTab,
  profile,
  cartCount = 0,
  wishlistCount = 0,
  onOpenCart,
  children,
}) {
  const debt = profile?.debt_outstanding || 0

  return (
    <div className="sh-app-shell">
      {/* Debt hold notice banner if user has outstanding debt */}
      {debt > 0 && (
        <div
          style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '9px 18px',
            textAlign: 'center',
            fontSize: '12.5px',
            fontWeight: 600,
            borderBottom: '1px solid #ffcdd2',
          }}
        >
          ⚠️ Outstanding fees ({debt.toLocaleString('vi-VN')}₫). Please settle in{' '}
          <button
            type="button"
            onClick={() => onSelectTab('fines')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#8f1d1d',
              fontWeight: 800,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Fines
          </button>
          .
        </div>
      )}

      {/* Figma Brown Top Bar (#6E472A): Centered ShelfHelp logo + Right Bell & Cart icons */}
      <header className="sh-topbar">
        <div className="sh-topbar-inner">
          <div className="sh-topbar-left" />

          <div className="sh-topbar-center" onClick={() => onSelectTab(activeTab === 'loans' ? 'loans' : 'books')}>
            {activeTab !== 'loans' && <ShelfBookLogo size={24} />}
            <span>{activeTab === 'loans' ? 'My Loans' : 'ShelfHelp'}</span>
          </div>

          <div className="sh-topbar-right">
            <button
              type="button"
              className="sh-icon-btn sh-icon-btn-ghost"
              title="Notifications & Reservations"
              aria-label="Notifications"
              onClick={() => onSelectTab('reservations')}
            >
              <BellIcon size={22} />
            </button>

            <button
              type="button"
              className="sh-icon-btn sh-icon-btn-ghost"
              title="Borrowing Cart"
              aria-label="Open borrowing cart"
              onClick={onOpenCart}
            >
              <CartIcon size={22} />
              {cartCount > 0 && <span className="sh-cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      {/* Figma Bottom Navigation Bar (Discover, Wishlist, My Loans, Profile) */}
      <nav className="sh-bottom-nav" aria-label="Primary reader navigation">
        <div className="sh-bottom-nav-inner">
          <button
            type="button"
            className={`sh-bottom-nav-btn ${activeTab === 'books' ? 'active' : ''}`}
            onClick={() => onSelectTab('books')}
          >
            <SearchIcon size={22} />
            <span>Discover</span>
          </button>

          <button
            type="button"
            className={`sh-bottom-nav-btn ${activeTab === 'wishlist' ? 'active' : ''}`}
            onClick={() => onSelectTab('wishlist')}
          >
            <HeartIcon size={22} filled={activeTab === 'wishlist'} />
            <span>Wishlist</span>
            {wishlistCount > 0 && <span className="sh-bottom-nav-dot">{wishlistCount}</span>}
          </button>

          <button
            type="button"
            className={`sh-bottom-nav-btn ${activeTab === 'loans' ? 'active' : ''}`}
            onClick={() => onSelectTab('loans')}
          >
            <LoansNavIcon size={22} />
            <span>My Loans</span>
          </button>

          <button
            type="button"
            className={`sh-bottom-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => onSelectTab('profile')}
          >
            <UserNavIcon size={22} />
            <span>Profile</span>
            {debt > 0 && <span className="sh-bottom-nav-dot">!</span>}
          </button>
        </div>
      </nav>
    </div>
  )
}
