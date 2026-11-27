import { useState } from 'react'
import { AuthLayout } from './components/AuthLayout.jsx'
import { AuthInput } from './components/AuthInput.jsx'
import { UserIcon, LockIcon } from './components/AuthIcons.jsx'
import { useAuth } from './AuthContext.jsx'
import { supabase } from '../../lib/supabase'

export function LoginPage({ onNavigate }) {
  const { loginWithEmail } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter both email/ID and password')
      return
    }

    setLoading(true)
    try {
      let loginEmail = identifier.trim().toLowerCase()

      // Support entering Student ID instead of email (e.g., "24125000" or "80921")
      if (!loginEmail.includes('@')) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email')
          .eq('student_id', identifier.trim())
          .maybeSingle()

        if (prof?.email) {
          loginEmail = prof.email.toLowerCase()
        }
      }

      await loginWithEmail(loginEmail, password)
    } catch (err) {
      console.error('Login error:', err)
      if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError')) {
        setErrorMessage('Unable to connect to Supabase (http://127.0.0.1:54321). Check Docker and run "npm run db:start".')
      } else if (err.status === 429) {
        setErrorMessage('Too many failed attempts. Please try again later.')
      } else {
        setErrorMessage(
          err.message?.includes('Invalid login credentials')
            ? 'The account is not loaded in the database. Run "npm run db:reset" in the terminal, then try again.'
            : err.message || 'Invalid email or password. Please try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const fillDemoAccount = (email, pass) => {
    setIdentifier(email)
    setPassword(pass)
    setErrorMessage('')
  }

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Time to get productive"
    >
      <form onSubmit={handleSubmit} noValidate>
        <AuthInput
          label="Email"
          type="text"
          placeholder="e.g. reader@campus.edu or 80921"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          icon={UserIcon}
          autoComplete="username"
          required
        />

        <AuthInput
          label="Password"
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={LockIcon}
          autoComplete="current-password"
          required
        />

        <div className="auth-forgot-link-row">
          <button
            type="button"
            className="auth-link"
            onClick={() => onNavigate('forgot-password')}
          >
            Trouble signing in?
          </button>
        </div>

        <button
          type="submit"
          className="auth-btn-primary"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        {errorMessage && (
          <div className="auth-error-message" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Quick Fill Box for Team Dev / Testing */}
        <div style={{
          marginTop: '16px',
          padding: '10px 12px',
          backgroundColor: '#fcfaf6',
          borderRadius: '10px',
          border: '1px dashed #dfd6c8',
          fontSize: '11.5px',
          lineHeight: '1.6',
          color: '#6e665e',
          textAlign: 'left'
        }}>
          <div style={{ fontWeight: 600, color: '#2a2421', marginBottom: '2px' }}>
            💡 Shared demo accounts:
          </div>
          <div>
            🎓 Student: <button type="button" className="auth-link" style={{ fontSize: '11.5px', textDecoration: 'underline' }} onClick={() => fillDemoAccount('student@shelfhelp.edu.vn', 'Password123!')}>student@shelfhelp.edu.vn</button> (or Student ID <code>24125000</code>)
          </div>
          <div>
            👔 Librarian: <button type="button" className="auth-link" style={{ fontSize: '11.5px', textDecoration: 'underline' }} onClick={() => fillDemoAccount('admin@shelfhelp.edu.vn', 'Password123!')}>admin@shelfhelp.edu.vn</button>
          </div>
          <div style={{ fontSize: '11px', color: '#8c827a', marginTop: '2px' }}>
            Shared password: <code>Password123!</code> <em>(Click an email to fill it)</em>
          </div>
        </div>

        <div className="auth-divider" />

        <p className="auth-footer-text">
          New patron?{' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => onNavigate('register')}
          >
            Sign up
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
