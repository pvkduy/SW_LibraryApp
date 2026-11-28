import { useState } from 'react'
import { AuthLayout } from './components/AuthLayout.jsx'
import { AuthInput } from './components/AuthInput.jsx'
import { LockIcon } from './components/AuthIcons.jsx'
import { useAuth } from './AuthContext.jsx'
import { isValidPassword } from '@shelfhelp/shared'

export function ResetPasswordPage({ onNavigate }) {
  const { updatePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!isValidPassword(newPassword)) {
      setErrorMessage('Password must be at least 8 characters with at least one letter and one number')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await updatePassword(newPassword)
      onNavigate('login')
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password. Link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create a new password"
      subtitle="Choose a new password for your library account."
    >
      <form onSubmit={handleSubmit} noValidate>
        <AuthInput
          label="New password"
          type="password"
          placeholder="Min 8 characters, 1 letter & 1 number"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          icon={LockIcon}
          required
        />

        <AuthInput
          label="Confirm password"
          type="password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={LockIcon}
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
          {loading ? 'Resetting password...' : 'Reset password'}
        </button>
      </form>
    </AuthLayout>
  )
}
