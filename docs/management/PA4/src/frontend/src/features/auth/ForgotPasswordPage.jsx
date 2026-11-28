import { useState } from 'react'
import { AuthLayout } from './components/AuthLayout.jsx'
import { AuthInput } from './components/AuthInput.jsx'
import { MailIcon } from './components/AuthIcons.jsx'
import { useAuth } from './AuthContext.jsx'

export function ForgotPasswordPage({ onNavigate }) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!email.trim()) {
      setErrorMessage('Please enter your institutional email')
      return
    }

    setLoading(true)
    try {
      await resetPassword(email.trim().toLowerCase())
      // Always show success message to prevent user enumeration (FR-AUTH-04)
      setSubmitted(true)
    } catch {
      // Even on error, avoid revealing whether account exists unless rate limited
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email to receive a recovery code."
    >
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p style={{ fontSize: '14px', color: '#2a2421', lineHeight: '1.5' }}>
            If an account matches <strong>{email}</strong>, a recovery link has been dispatched to your inbox.
          </p>
          <button
            type="button"
            className="auth-btn-primary"
            onClick={() => onNavigate('login')}
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <AuthInput
            label="Email"
            type="email"
            placeholder="e.g. e.vance@university.edu or student"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={MailIcon}
            autoComplete="email"
            required
          />

          {errorMessage && (
            <div className="auth-error-message" role="alert">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
          >
            {loading ? 'Sending code...' : 'Send code'}
          </button>

          <div className="auth-divider" />

          <p className="auth-footer-text">
            Remembered it?{' '}
            <button
              type="button"
              className="auth-link"
              onClick={() => onNavigate('login')}
            >
              Back to sign in
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
