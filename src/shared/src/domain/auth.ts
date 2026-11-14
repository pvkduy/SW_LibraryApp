import { DEFAULT_SETTINGS } from '../settings-defaults/index'

export interface RegistrationInput {
  fullName: string
  email: string
  studentId: string
  password: string
  confirmPassword?: string
  faculty?: string
  phone?: string
}

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

/**
 * Checks whether an email matches any pattern in the allowlist.
 * Supports wildcards like '*.edu.vn' or exact domains.
 */
export function isAllowedEmailDomain(
  email: string,
  allowlist: string[] = DEFAULT_SETTINGS.email_domain_allowlist
): boolean {
  if (!email || !email.includes('@')) return false
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false

  return allowlist.some((pattern) => {
    const cleanPattern = pattern.toLowerCase().trim()
    if (cleanPattern.startsWith('*.')) {
      const suffix = cleanPattern.slice(2)
      return domain === suffix || domain.endsWith('.' + suffix)
    }
    return domain === cleanPattern
  })
}

/**
 * Validates a student ID against the configured regex pattern.
 */
export function isValidStudentId(
  studentId: string,
  pattern: string = DEFAULT_SETTINGS.student_id_pattern
): boolean {
  if (!studentId) return false
  const regex = new RegExp(pattern)
  return regex.test(studentId.trim())
}

/**
 * Enforces POL-02: Min 8 chars, at least one letter and one digit.
 */
export function isValidPassword(password: string): boolean {
  if (!password || password.length < 8) return false
  const hasLetter = /[A-Za-z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  return hasLetter && hasDigit
}

/**
 * Validates student registration fields on client and server (POL-02).
 */
export function validateStudentRegistration(
  input: RegistrationInput,
  settings = DEFAULT_SETTINGS
): ValidationResult {
  const errors: Record<string, string> = {}

  if (!input.fullName || !input.fullName.trim()) {
    errors.fullName = 'Full name is required'
  }

  if (!input.studentId || !isValidStudentId(input.studentId, settings.student_id_pattern)) {
    errors.studentId = 'Student ID must be 6-15 alphanumeric characters'
  }

  if (!input.email || !input.email.trim()) {
    errors.email = 'Institutional email is required'
  } else if (!isAllowedEmailDomain(input.email, settings.email_domain_allowlist)) {
    errors.email = 'Email domain must be a valid institutional address (*.edu.vn)'
  }

  if (!input.password || !isValidPassword(input.password)) {
    errors.password = 'Password must be at least 8 characters with at least one letter and one number'
  }

  if (input.confirmPassword !== undefined && input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
