import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './AuthIcons.jsx'
import '../auth.css'

export function AuthInput({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  icon: Icon,
  error,
  autoComplete,
  required = false,
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const computedType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="auth-field">
      {label && <label className="auth-label">{label}</label>}
      <div className={`auth-input-wrapper ${error ? 'has-error' : ''}`}>
        {Icon && (
          <span className="auth-icon">
            <Icon />
          </span>
        )}
        <input
          className="auth-input"
          type={computedType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
        />
        {isPassword && (
          <button
            type="button"
            className="auth-icon-button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && <span className="auth-field-error">{error}</span>}
    </div>
  )
}
