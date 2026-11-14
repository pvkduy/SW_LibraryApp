import { BookIcon } from './AuthIcons.jsx'
import '../auth.css'

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-viewport">
      <div className="auth-container">
        {/* Top Header Card */}
        <header className="auth-header-card">
          <div className="auth-badge-circle">
            <BookIcon />
          </div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
        </header>

        {/* Main Form Content Card */}
        <main className="auth-form-card">
          {children}
        </main>
      </div>
    </div>
  )
}
