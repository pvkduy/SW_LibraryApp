import React from 'react'
import './admin.css'
import {
  IconDashboard,
  IconReports,
  IconCirculation,
  IconBooks,
  IconAcquisitions,
  IconQueues,
  IconPeople,
  IconMoney,
  IconBell
} from './AdminIcons'

export function AdminLayout({ activePage = 'circulation', onNavigate, profile, onLogout, children }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
    { id: 'circulation', label: 'Circulation', icon: IconCirculation },
    { id: 'books', label: 'Books', icon: IconBooks },
    { id: 'acquisitions', label: 'Acquisitions', icon: IconAcquisitions },
    { id: 'queues', label: 'Queues', icon: IconQueues },
    { id: 'people', label: 'People', icon: IconPeople },
    { id: 'money', label: 'Money', icon: IconMoney },
    { id: 'reports', label: 'Reports', icon: IconReports },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon"><IconBooks size={16} color="#fff" /></div>
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
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-system-status">
            <span>System Status</span>
            <span className="admin-status-dot" />
          </div>
          <button
            type="button"
            className="admin-logout-button"
            onClick={onLogout}
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-spacer" />
          <div className="admin-header-account">
            <button type="button" className="admin-notifications" aria-label="Notifications">
              <IconBell size={18} color="#72685e" />
              <span
                className="admin-notification-count"
              >
                3
              </span>
            </button>

            <div className="admin-avatar">
              {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'TH'}
            </div>
            <div className="admin-account-details">
              <div className="admin-account-name">
                {profile?.full_name || 'Thủ Thư (Librarian)'}
              </div>
              <div className="admin-account-id">{profile?.student_id || profile?.email || 'Library Staff'}</div>
            </div>
          </div>
        </header>

        <main className="admin-page-content">{children}</main>
      </div>
    </div>
  )
}
