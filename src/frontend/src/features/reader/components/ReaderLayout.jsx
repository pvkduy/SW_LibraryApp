import './reader.css'

export function ReaderLayout({ activeTab, onSelectTab, user, profile, onLogout, children }) {
  const debt = profile?.debt_outstanding || 0

  return (
    <div className="reader-layout">
      {/* Debt hold notice banner if user has outstanding debt */}
      {debt > 0 && (
        <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px 20px', textAlign: 'center', fontSize: '13px', fontWeight: 600, borderBottom: '1px solid #ffcdd2' }}>
          ⚠️ Bạn đang có khoản phí chưa thanh toán ({debt.toLocaleString('vi-VN')} đ). Vui lòng vào mục Tiền phạt để thanh toán.
        </div>
      )}

      <header className="reader-header">
        <div className="reader-header-inner">
          <div className="reader-brand" onClick={() => onSelectTab('books')}>
            <div className="reader-brand-logo">S</div>
            <div>
              <h1 className="reader-brand-title">ShelfHelp</h1>
            </div>
          </div>

          <nav className="reader-nav">
            <button
              type="button"
              className={`reader-nav-item ${activeTab === 'books' ? 'active' : ''}`}
              onClick={() => onSelectTab('books')}
            >
              📖 Khám phá sách
            </button>
            <button
              type="button"
              className={`reader-nav-item ${activeTab === 'loans' ? 'active' : ''}`}
              onClick={() => onSelectTab('loans')}
            >
              📚 Sách của tôi
            </button>
            <button
              type="button"
              className={`reader-nav-item ${activeTab === 'fines' ? 'active' : ''}`}
              onClick={() => onSelectTab('fines')}
            >
              💳 Tiền phạt
              {debt > 0 && <span className="reader-nav-badge">Nợ</span>}
            </button>
            <button
              type="button"
              className={`reader-nav-item ${activeTab === 'reservations' ? 'active' : ''}`}
              onClick={() => onSelectTab('reservations')}
            >
              ⏳ Đặt trước
            </button>
          </nav>

          <div className="reader-user-controls">
            <span className="reader-user-badge">
              {profile?.full_name || user?.email}
            </span>
            <button
              type="button"
              className="auth-btn-primary"
              style={{ width: 'auto', height: '34px', padding: '0 14px', marginTop: 0, fontSize: '13px', backgroundColor: '#efe6da', color: '#52473f', border: '1px solid #dcd3c6' }}
              onClick={onLogout}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="reader-body">
        {children}
      </main>
    </div>
  )
}
