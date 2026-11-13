import { useState } from 'react'
import { AuthLayout } from './components/AuthLayout.jsx'
import { AuthInput } from './components/AuthInput.jsx'
import { MailIcon } from './components/AuthIcons.jsx'
import { useAuth } from './AuthContext.jsx'
import { validateStudentRegistration } from '@shelfhelp/shared'

export function RegisterPage({ onNavigate, onRegistered }) {
  const { registerStudent } = useAuth()
  const [fullName, setFullName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [fieldErrors, setFieldErrors] = useState({})
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setFieldErrors({})

    // Client-side validation (POL-02)
    const validation = validateStudentRegistration({
      fullName,
      studentId,
      email,
      password,
      confirmPassword,
    })

    if (!validation.valid) {
      setFieldErrors(validation.errors)
      setErrorMessage(Object.values(validation.errors)[0] || 'Please complete all required fields')
      return
    }

    setLoading(true)
    try {
      await registerStudent({
        fullName: fullName.trim(),
        studentId: studentId.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
      })

      if (onRegistered) {
        onRegistered(email.trim().toLowerCase())
      } else {
        onNavigate('verify-otp', { email: email.trim().toLowerCase() })
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Join ShelfHelp Today"
      subtitle="Access all our library services with a new account."
    >
      <form onSubmit={handleSubmit} noValidate>
        <AuthInput
          label="Full Name"
          type="text"
          placeholder="e.g. Alex Vance"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fieldErrors.fullName}
          required
        />

        <AuthInput
          label="Student ID"
          type="text"
          placeholder="e.g. 24125060"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          error={fieldErrors.studentId}
          required
        />

        <AuthInput
          label="Institutional Email"
          type="email"
          placeholder="e.g. student@university.edu.vn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={MailIcon}
          error={fieldErrors.email}
          required
        />

        <AuthInput
          label="Password"
          type="password"
          placeholder="Min 8 characters, 1 letter & 1 number"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />

        <AuthInput
          label="Confirm Password"
          type="password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
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
          {loading ? 'Registering...' : 'Complete Registration'}
        </button>

        <div className="auth-divider" />

        <p className="auth-footer-text">
          Already have an account?{' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => onNavigate('login')}
          >
            Sign In
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
