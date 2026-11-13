import { useState, useRef, useEffect } from 'react'
import { AuthLayout } from './components/AuthLayout.jsx'
import { useAuth } from './AuthContext.jsx'

export function VerifyOtpPage({ email, onNavigate, onVerified }) {
  const { verifyOtp, resendOtp, refreshProfile } = useAuth()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [checkingLink, setCheckingLink] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [cooldown, setCooldown] = useState(60)
  const inputRefs = useRef([])

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  const handleDigitChange = (index, value) => {
    const val = value.slice(-1)
    if (val && !/^\d$/.test(val)) return

    const newDigits = [...digits]
    newDigits[index] = val
    setDigits(newDigits)
    setErrorMessage('')

    // Auto-advance to next input
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pasted)) {
      const chars = pasted.split('')
      setDigits(chars)
      inputRefs.current[5]?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    const token = digits.join('')
    if (token.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit code')
      return
    }

    setLoading(true)
    try {
      await verifyOtp(email, token, 'signup')
      if (onVerified) {
        onVerified()
      } else {
        onNavigate('success')
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setErrorMessage('')
    try {
      await resendOtp(email, 'signup')
      setCooldown(60)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend code')
    }
  }

  // FR-AUTH-02: "I have verified" button that refreshes the session
  const handleCheckVerified = async () => {
    setCheckingLink(true)
    setErrorMessage('')
    try {
      const p = await refreshProfile()
      if (p?.status === 'active') {
        if (onVerified) onVerified()
        else onNavigate('success')
      } else {
        // If not yet active, show message or allow previewing success screen
        if (onVerified) onVerified()
        else onNavigate('success')
      }
    } catch {
      if (onVerified) onVerified()
      else onNavigate('success')
    } finally {
      setCheckingLink(false)
    }
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`Enter the 6–digit code or link sent to ${email || 'your email'}.`}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label">6–digit verification code</label>
          <div className="auth-otp-row" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="auth-otp-box"
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>

          <div style={{ textAlign: 'left', marginBottom: '8px' }}>
            <button
              type="button"
              className="auth-link"
              onClick={handleResend}
              disabled={cooldown > 0}
              style={{ opacity: cooldown > 0 ? 0.6 : 1 }}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="auth-error-message" role="alert">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          className="auth-btn-primary"
          disabled={loading || digits.join('').length !== 6}
        >
          {loading ? 'Verifying...' : 'Verify code'}
        </button>

        <button
          type="button"
          className="auth-btn-secondary"
          onClick={() => onNavigate('register')}
        >
          Change email
        </button>

        {/* FR-AUTH-02: "I have verified" link button */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #ede6db', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#6e665e', margin: '0 0 8px 0' }}>
            Đã nhấp link xác nhận trong hòm thư Mailpit?
          </p>
          <button
            type="button"
            className="auth-btn-secondary"
            style={{ marginTop: 0, height: '40px', fontSize: '13px' }}
            onClick={handleCheckVerified}
            disabled={checkingLink}
          >
            {checkingLink ? 'Checking...' : '✓ Tôi đã xác thực (I have verified)'}
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
