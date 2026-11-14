import { CheckIcon, CloseIcon, LogoutIcon } from './AuthIcons.jsx'
import '../auth.css'

export function AuthConfirmModal({
  title = 'Xác nhận đăng xuất',
  subtitle = 'Bạn có chắc chắn muốn kết thúc phiên làm việc không?',
  confirmText = 'Đăng xuất',
  cancelText = 'Không, ở lại',
  onConfirm,
  onCancel,
}) {
  return (
    <div className="auth-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '380px', padding: '32px 24px 28px' }}
      >
        <div className="auth-modal-icon-badge warning" style={{ width: '64px', height: '64px', marginBottom: '16px' }}>
          <LogoutIcon size={28} />
        </div>
        <h2 className="auth-title" style={{ fontSize: '20px', marginBottom: '8px' }}>{title}</h2>
        <p className="auth-subtitle" style={{ marginBottom: '24px', fontSize: '13.5px' }}>{subtitle}</p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="auth-btn-secondary"
            style={{ marginTop: 0, flex: 1, height: '42px', fontSize: '14px' }}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="auth-btn-primary"
            style={{ marginTop: 0, flex: 1, height: '42px', fontSize: '14px', backgroundColor: '#c85a3e' }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AuthSuccessModal({
  title = 'Registration Completed',
  subtitle = 'Welcome to ShelfHelp!',
  buttonText = 'Back to Home',
  onAction,
}) {
  return (
    <div className="auth-viewport">
      <div className="auth-modal-card">
        <div className="auth-modal-icon-badge success">
          <CheckIcon />
        </div>
        <h2 className="auth-title">{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>

        <button type="button" className="auth-btn-primary" onClick={onAction}>
          {buttonText}
        </button>
      </div>
    </div>
  )
}

export function AuthErrorModal({
  title = 'Something went wrong',
  subtitle = 'Please try again later',
  buttonText = 'Try Again',
  onAction,
}) {
  return (
    <div className="auth-viewport">
      <div className="auth-modal-card">
        <div className="auth-modal-icon-badge error">
          <CloseIcon />
        </div>
        <h2 className="auth-title">{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>

        <button type="button" className="auth-btn-primary" onClick={onAction}>
          {buttonText}
        </button>
      </div>
    </div>
  )
}
