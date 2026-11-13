import { CheckIcon, CloseIcon } from './AuthIcons.jsx'
import '../auth.css'

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
