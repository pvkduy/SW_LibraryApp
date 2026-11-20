import React, { useState } from 'react'
import './admin.css'
import {
  IconDashboard,
  IconCirculation,
  IconBooks,
  IconQueues,
  IconPeople,
  IconMoney,
  IconBell,
  IconSearch
} from './AdminIcons'

export function AdminLayout({ activePage = 'circulation', onNavigate, profile, onLogout, children }) {
  const [searchQuery, setSearchQuery] = useState('')

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
    { id: 'circulation', label: 'Circulation', icon: IconCirculation },
    { id: 'books', label: 'Books', icon: IconBooks },
    { id: 'queues', label: 'Queues & Holds', icon: IconQueues },
    { id: 'people', label: 'People', icon: IconPeople },
    { id: 'money', label: 'Money', icon: IconMoney },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon">SH</div>
          <div>
            <div className="admin-brand-title">ShelfHelp</div>
            <div className="admin-brand-sub">Archival & Circulation Desk</div>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate && onNavigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-system-status">
            <span className="admin-status-dot" />
            <span>Postgres DB Local · Online</span>
          </div>
          <button
            type="button"
            className="admin-btn-outline"
            style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
            onClick={onLogout}
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-search">
            <IconSearch size={16} color="#9d9388" />
            <input
              type="text"
              placeholder="Search student ID, barcode, ISBN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="admin-user-pill">
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              <IconBell size={20} color="#72685e" />
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: '50%',
                  fontSize: '10px',
                  fontWeight: 700,
                  width: '15px',
                  height: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                3
              </span>
            </div>

            <div className="admin-avatar">
              {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'TH'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#241e19' }}>
                {profile?.full_name || 'Thủ Thư (Librarian)'}
              </div>
              <div style={{ fontSize: '11px', color: '#72685e' }}>LIB - 24125105</div>
            </div>
          </div>
        </header>

        <main className="admin-page-content">{children}</main>
      </div>
    </div>
  )
}
