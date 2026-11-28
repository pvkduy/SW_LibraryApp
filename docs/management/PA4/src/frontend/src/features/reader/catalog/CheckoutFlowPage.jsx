import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { useCart } from './useCart'
import { ALLOWED_DURATIONS, calculateLineFee, formatVnd } from './cartHelpers'
import {
  BackArrowIcon,
  CheckCircleIcon,
  InfoIcon,
  PickupQrSvg,
  ReceiptIcon,
  ShelfBookLogo,
} from './CatalogIcons'
import './catalog.css'

const SHOW_SIMULATOR_CONTROLS = import.meta.env.VITE_PAYMENT_SIMULATOR_CONTROLS === 'true'

/**
 * Figma Screens 5 (Borrowing Cart), 6 (Checkout Confirmation), and 7 (SuccessWithPickupQR).
 * Implements R-10, R-11, R-13, FR-CART-01..08.
 */
export function CheckoutFlowPage({ profile, user, onBackToCatalog, onGoToLoans, onGoToFines }) {
  const {
    cartItems,
    activeLoansCount,
    maxItems,
    updateDuration,
    removeFromCart,
    refreshCartState,
  } = useCart()

  const [step, setStep] = useState('cart') // 'cart' | 'confirm' | 'payment_failed' | 'success'
  const [paymentMethod, setPaymentMethod] = useState('mobile_banking') // 'mobile_banking' | 'card' | 'counter'
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [lineErrors, setLineErrors] = useState({})
  const [receiptData, setReceiptData] = useState(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [remainingText, setRemainingText] = useState('48h 00m remaining')
  const [idempotencyKey, setIdempotencyKey] = useState(() => `chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  // Refresh live availability when entering cart (FR-CART-02)
  useEffect(() => {
    refreshCartState()
  }, [refreshCartState])

  // Live 48-hour pickup countdown on confirmation screen (UC-10 §2.1.1)
  useEffect(() => {
    if (step !== 'success' || !receiptData) return undefined
    const baseMs = receiptData.timestamp ? new Date(receiptData.timestamp).getTime() : Date.now()
    const deadlineMs = (Number.isFinite(baseMs) ? baseMs : Date.now()) + 48 * 60 * 60 * 1000

    const updateRemaining = () => {
      const diffMs = Math.max(0, deadlineMs - Date.now())
      const hrs = Math.floor(diffMs / 3600000)
      const mins = Math.floor((diffMs % 3600000) / 60000)
      setRemainingText(diffMs === 0 ? 'Pickup window expired' : `${hrs}h ${String(mins).padStart(2, '0')}m remaining`)
    }

    updateRemaining()
    const id = window.setInterval(updateRemaining, 30000)
    return () => window.clearInterval(id)
  }, [step, receiptData])

  const isMember = false // Non-member default unless active membership plan exists
  const allowedDurations = useMemo(() => (isMember ? ALLOWED_DURATIONS : [7]), [isMember])
  const debtOutstanding = profile?.debt_outstanding || 0
  const isAccountBlocked = profile?.status === 'restricted' || profile?.status === 'inactive' || debtOutstanding > 0

  const enrichedItems = useMemo(
    () =>
      cartItems.map((item) => {
        const isUnavailable =
          (item.book?.available_copies ?? 0) <= 0 ||
          (item.copy && item.copy.status && item.copy.status !== 'available')
        const effectiveDuration = allowedDurations.includes(item.duration_days)
          ? item.duration_days
          : allowedDurations[0]
        const fee = calculateLineFee(item.book?.collection, effectiveDuration, isMember)
        return { ...item, duration_days: effectiveDuration, isUnavailable, fee }
      }),
    [cartItems, isMember, allowedDurations],
  )

  const hasUnavailable = enrichedItems.some((item) => item.isUnavailable)
  const hasPremiumItem = enrichedItems.some((item) => item.book?.collection === 'premium')
  const subtotal = enrichedItems.reduce((sum, item) => sum + item.fee, 0)

  const handleContinueToConfirm = () => {
    setErrorMsg(null)
    if (isAccountBlocked) {
      setErrorMsg(
        debtOutstanding > 0
          ? `Debt Hold Active: Please settle your outstanding balance (${formatVnd(debtOutstanding)}) before checking out.`
          : 'Your account is currently restricted. Borrowing is disabled.',
      )
      return
    }
    if (enrichedItems.length === 0) {
      setErrorMsg('Your borrowing cart is empty.')
      return
    }
    if (hasUnavailable) {
      setErrorMsg('Please remove unavailable books before continuing.')
      return
    }
    setStep('confirm')
  }

  const handleConfirmCheckout = async () => {
    setSubmitting(true)
    setErrorMsg(null)
    setLineErrors({})

    const payload = {
      items: enrichedItems.map((item) => ({
        book_id: item.book_id,
        preferred_copy_id: item.preferred_copy_id || null,
        duration_days: item.duration_days,
      })),
      payment_method: paymentMethod,
      idempotency_key: idempotencyKey,
      simulate_failure: SHOW_SIMULATOR_CONTROLS && subtotal > 0 && paymentMethod !== 'counter' && simulateFailure,
    }

    try {
      const data = await api.invoke('checkout-cart', payload)
      if (!data?.success) {
        if (Array.isArray(data?.line_errors)) {
          const mapped = {}
          data.line_errors.forEach((d) => {
            if (d.book_id) mapped[d.book_id] = d.message
          })
          setLineErrors(mapped)
        }
        throw new Error(data?.message || 'Checkout failed.')
      }

      setReceiptData(data)
      await refreshCartState()
      // Rotate idempotency key for future checkouts
      setIdempotencyKey(`chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

      if (data.payment_status === 'failed') {
        setStep('payment_failed')
      } else {
        setStep('success')
      }
    } catch (err) {
      if (Array.isArray(err.details)) {
        const mapped = {}
        err.details.forEach((d) => {
          if (d.book_id) mapped[d.book_id] = d.message
        })
        setLineErrors(mapped)
      }
      setErrorMsg(err.message || 'Unable to complete checkout.')
      if (Array.isArray(err.details) && err.details.length > 0) {
        setStep('cart')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handlePaymentRecovery = async (outcome) => {
    if (!receiptData?.payment_id) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const data = await api.invoke('complete-simulated-payment', {
        payment_id: receiptData.payment_id,
        outcome,
      })
      if (!data?.success) throw new Error(data?.message || 'Action failed.')

      if (outcome === 'cancel') {
        await refreshCartState()
        onBackToCatalog()
      } else {
        setReceiptData((prev) => ({
          ...prev,
          payment_status: data.status || 'succeeded',
          payment_method: outcome === 'switch_counter' ? 'counter' : prev.payment_method,
        }))
        setStep('success')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Payment recovery failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTimestamp = (iso) => {
    if (!iso) return 'Just now'
    try {
      const d = new Date(iso)
      return d.toLocaleString('vi-VN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return 'Just now'
    }
  }

  // =========================================================================
  // Figma Screen 7: SuccessWithPickupQR
  // =========================================================================
  if (step === 'success' && receiptData) {
    const refId = receiptData.reference_id || `RSH-${receiptData.pickup_code || '884021'}`
    const pickupCode = receiptData.pickup_code || refId
    const isCounterPending = receiptData.payment_method === 'counter' && (receiptData.total_amount || 0) > 0
    const handleCopyCode = async () => {
      try {
        await navigator.clipboard.writeText(pickupCode)
        setCopiedCode(true)
        window.setTimeout(() => setCopiedCode(false), 2000)
      } catch {
        // clipboard unavailable
      }
    }

    return (
      <div className="sh-app-shell" style={{ background: '#ffffff' }}>
        <div className="sh-success-page">
          <div className="sh-success-badge">
            <CheckCircleIcon size={34} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#241e19' }}>
            {isCounterPending ? 'Request Confirmed' : 'Transaction Completed'}
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#6e665e', lineHeight: 1.5 }}>
            {isCounterPending
              ? `Status: Awaiting Counter Payment. Please visit the library circulation desk within 48 hours, present your pickup code, and pay ${formatVnd(receiptData.total_amount)} before collecting your books.`
              : 'Show this pickup QR at the circulation desk. Access receipts at My Loans > Payment History.'}
          </p>

          {/* Scannable Pickup QR Code + Copy Button + 48h Countdown (UC-10 §2.1.1) */}
          <div className="sh-qr-box">
            <PickupQrSvg value={refId} size={168} />
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '2px', color: '#6e472a' }}>
                {pickupCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                style={{
                  background: '#f3ede5',
                  border: '1px solid #d9cbbd',
                  color: '#6e472a',
                  borderRadius: '8px',
                  padding: '3px 9px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copiedCode ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: '11.5px', color: '#8c8277', marginTop: '4px', fontWeight: 600 }}>
              48-hour pickup window • {remainingText}
            </div>
          </div>

          {/* Receipt Card (Figma Screen 7) */}
          <div className="sh-receipt-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: '#241e19' }}>
              <ReceiptIcon size={16} color="#6e472a" />
              Receipt
            </div>
            <div className="sh-receipt-row">
              <span>Reference ID</span>
              <strong>{refId}</strong>
            </div>
            <div className="sh-receipt-row">
              <span>Timestamp</span>
              <strong>{formatTimestamp(receiptData.timestamp)}</strong>
            </div>
            <div className="sh-receipt-row">
              <span>Patron</span>
              <strong>{receiptData.patron_name || profile?.full_name || user?.email}</strong>
            </div>
            <div className="sh-receipt-row">
              <span>Pickup Location</span>
              <strong>{receiptData.pickup_location || 'Main Library Circulation Desk'}</strong>
            </div>
            <div className="sh-receipt-row">
              <span>Payment</span>
              <strong>
                {receiptData.total_amount > 0
                  ? `${formatVnd(receiptData.total_amount)} (${receiptData.payment_method === 'counter' ? 'Cash At Counter' : 'Paid Online'})`
                  : 'Free (Standard Loan)'}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="sh-btn-primary"
              style={{ width: '100%' }}
              onClick={onGoToLoans}
            >
              View My Loans
            </button>
            <button
              type="button"
              className="sh-btn-primary"
              style={{ width: '100%', background: '#8b5e3c' }}
              onClick={onBackToCatalog}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // Simulated Payment Failure Recovery Screen (FR-CART-06)
  // =========================================================================
  if (step === 'payment_failed' && receiptData) {
    return (
      <div className="sh-app-shell">
        <header className="sh-topbar">
          <div className="sh-topbar-inner">
            <button type="button" className="sh-icon-btn sh-icon-btn-ghost" onClick={onBackToCatalog}>
              <BackArrowIcon size={20} />
            </button>
            <div className="sh-topbar-center">Simulated Payment Gateway</div>
            <div style={{ width: '36px' }} />
          </div>
        </header>
        <main className="sh-container sh-container-narrow">
          <div className="sh-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fce8e6',
                color: '#c5221f',
                margin: '0 auto 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 800,
              }}
            >
              !
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: '19px' }}>Payment Failed</h2>
            <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: '#6e665e' }}>
              Your simulated online payment of <strong>{formatVnd(receiptData.total_amount)}</strong> was declined.
              Your copies are held for 30 minutes while you retry or switch to counter payment.
            </p>
            {errorMsg && <p style={{ color: '#c5221f', fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="sh-btn-primary"
                disabled={submitting}
                onClick={() => handlePaymentRecovery('succeed')}
              >
                {submitting ? 'Processing...' : 'Retry Online Payment (Succeed)'}
              </button>
              <button
                type="button"
                className="sh-btn-outline"
                disabled={submitting}
                onClick={() => handlePaymentRecovery('switch_counter')}
              >
                Switch to Cash At Counter (48h)
              </button>
              <button
                type="button"
                className="sh-btn-outline"
                style={{ borderColor: '#f4c7c3', color: '#c5221f' }}
                disabled={submitting}
                onClick={() => handlePaymentRecovery('cancel')}
              >
                Cancel Request &amp; Release Copies
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // Figma Screens 5 (Cart) & 6 (Confirmation)
  // =========================================================================
  return (
    <div className="sh-app-shell">
      {/* Top Brown Header matching Figma: ← Checkout */}
      <header className="sh-topbar">
        <div className="sh-topbar-inner">
          <div className="sh-topbar-left">
            <button
              type="button"
              className="sh-icon-btn sh-icon-btn-ghost"
              onClick={() => (step === 'confirm' ? setStep('cart') : onBackToCatalog())}
              aria-label="Go back"
            >
              <BackArrowIcon size={22} />
            </button>
          </div>
          <div className="sh-topbar-center">Checkout</div>
          <div className="sh-topbar-right" />
        </div>
      </header>

      {/* 2-Step Progress Stepper (1 Cart | 2 Confirmation) */}
      <div className="sh-stepper">
        <div className="sh-stepper-inner">
          <div className={`sh-step-tab ${step === 'cart' ? 'active' : 'done'}`}>
            <span className="sh-step-circle">1</span>
            <span>Cart</span>
          </div>
          <div className={`sh-step-tab ${step === 'confirm' ? 'active' : ''}`}>
            <span className="sh-step-circle">2</span>
            <span>Confirmation</span>
          </div>
        </div>
      </div>

      <main className="sh-container sh-container-narrow">
        {errorMsg && (
          <div
            style={{
              background: '#fce8e6',
              border: '1px solid #f4c7c3',
              color: '#c5221f',
              borderRadius: '12px',
              padding: '11px 14px',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '14px',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* STEP 1: BORROWING CART (Figma Screen 5, UC-09) */}
        {step === 'cart' && (
          <section>
            {isAccountBlocked && (
              <div
                style={{
                  background: '#fce8e6',
                  border: '1px solid #f4c7c3',
                  color: '#c5221f',
                  borderRadius: '12px',
                  padding: '11px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span>
                  {debtOutstanding > 0
                    ? `Debt Hold Active: You have outstanding fines totaling ${formatVnd(debtOutstanding)}. Please settle your library charges before requesting new books.`
                    : 'Your account is restricted. Borrowing is disabled until the restriction is resolved.'}
                </span>
                {debtOutstanding > 0 && onGoToFines && (
                  <button
                    type="button"
                    onClick={onGoToFines}
                    style={{
                      background: '#c5221f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Pay Fines
                  </button>
                )}
              </div>
            )}

            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700 }}>Selected Books</h3>

            {enrichedItems.length === 0 ? (
              <div className="sh-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <ShelfBookLogo size={38} color="#b8aea2" />
                <p style={{ margin: '12px 0 6px', fontWeight: 700 }}>Your borrowing cart is empty</p>
                <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#7c736a' }}>
                  Browse the catalog and pick available book copies to borrow.
                </p>
                <button type="button" className="sh-btn-primary" onClick={onBackToCatalog}>
                  Browse Catalogue
                </button>
              </div>
            ) : (
              <>
                {enrichedItems.map((item) => {
                  const lineErr = lineErrors[item.book_id]
                  const blocked = item.isUnavailable || Boolean(lineErr)
                  const idx = allowedDurations.indexOf(item.duration_days)
                  const canDec = idx > 0
                  const canInc = idx >= 0 && idx < allowedDurations.length - 1

                  return (
                    <div key={item.book_id} className={`sh-cart-item ${blocked ? 'unavailable' : ''}`}>
                      <div className="sh-cart-thumb">
                        <ShelfBookLogo size={24} color="#8c8277" />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#241e19' }}>
                            {item.book?.title}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.book_id)}
                            aria-label={`Remove ${item.book?.title}`}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#8c8277',
                              fontSize: '18px',
                              lineHeight: 1,
                              cursor: 'pointer',
                              padding: '0 4px',
                            }}
                          >
                            ×
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          {item.book?.collection === 'premium' && (
                            <span className="sh-badge-premium">Premium</span>
                          )}
                          {item.copy?.barcode && (
                            <span className="sh-badge-tag">{item.copy.barcode}</span>
                          )}
                        </div>

                        {blocked && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#c5221f' }}>
                              ⚠ {lineErr || 'No longer available'}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.book_id)}
                              style={{
                                background: '#fce8e6',
                                border: '1px solid #f4c7c3',
                                color: '#c5221f',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Remove ×
                            </button>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '14px', color: item.fee > 0 ? '#6e472a' : '#2e6930' }}>
                              {formatVnd(item.fee)}
                            </strong>
                            <span style={{ fontSize: '12px', color: '#8c8277' }}> / {item.duration_days} days</span>
                          </div>

                          <div
                            className="sh-duration-stepper"
                            aria-label="Loan duration selector"
                            title={!isMember ? '14-day loans require an active membership (UC-09)' : undefined}
                          >
                            <button
                              type="button"
                              disabled={!canDec}
                              onClick={() => updateDuration(item.book_id, allowedDurations[idx - 1])}
                              aria-label="Decrease loan days"
                            >
                              −
                            </button>
                            <span style={{ fontSize: '11.5px', fontWeight: 700, minWidth: '28px', textAlign: 'center' }}>
                              {item.duration_days}d
                            </span>
                            <button
                              type="button"
                              disabled={!canInc}
                              onClick={() => updateDuration(item.book_id, allowedDurations[idx + 1])}
                              aria-label="Increase loan days"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <div className="sh-perks-banner">
                  <InfoIcon size={16} color="#6e472a" />
                  <span>
                    {!isMember && hasPremiumItem
                      ? `Quota: ${activeLoansCount + enrichedItems.length}/${maxItems} items • Become a member to borrow Premium titles for free and unlock 14-day loans.`
                      : `Quota: ${activeLoansCount + enrichedItems.length}/${maxItems} items • Standard books are free to borrow (7 days for non-members).`}
                  </span>
                </div>
              </>
            )}
          </section>
        )}

        {/* STEP 2: CHECKOUT CONFIRMATION (Figma Screen 6) */}
        {step === 'confirm' && (
          <section>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700 }}>Payment Method</h3>

            {[
              {
                id: 'mobile_banking',
                title: 'Mobile Banking',
                sub: 'Instant scan with any Vietnamese banking app',
              },
              {
                id: 'card',
                title: 'Credit / Debit Card',
                sub: 'Card ending with ** 4242',
              },
              {
                id: 'counter',
                title: 'Cash At Counter',
                sub: 'Pay directly at the library circulation desk (48h hold)',
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`sh-payment-option ${paymentMethod === opt.id ? 'selected' : ''}`}
                onClick={() => setPaymentMethod(opt.id)}
              >
                <span className="sh-radio-dot" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#241e19' }}>{opt.title}</div>
                  <div style={{ fontSize: '12px', color: '#7c736a', marginTop: '2px' }}>{opt.sub}</div>
                </div>
              </button>
            ))}

            {/* Clearly labelled Simulated Payment Gateway Controls (FR-CART-06) */}
            {SHOW_SIMULATOR_CONTROLS && subtotal > 0 && paymentMethod !== 'counter' && (
              <div
                style={{
                  background: '#fff8e1',
                  border: '1px solid #ffe082',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#795548',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚡ Simulated Payment Gateway</div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                  />
                  Simulate payment failure (test retry / switch to counter flow)
                </label>
              </div>
            )}

            {/* Patron Details Card (Figma Screen 6) */}
            <h3 style={{ margin: '18px 0 12px', fontSize: '16px', fontWeight: 700 }}>Patron Details</h3>
            <div className="sh-card">
              <div className="sh-pub-grid">
                <div>
                  <small style={{ display: 'block', fontSize: '11px', color: '#8c8277' }}>Patron Name</small>
                  <strong style={{ fontSize: '13.5px' }}>{profile?.full_name || 'Student Reader'}</strong>
                </div>
                <div>
                  <small style={{ display: 'block', fontSize: '11px', color: '#8c8277' }}>Student ID</small>
                  <strong style={{ fontSize: '13.5px' }}>{profile?.student_id || 'STU-24125000'}</strong>
                </div>
                <div>
                  <small style={{ display: 'block', fontSize: '11px', color: '#8c8277' }}>Phone Number</small>
                  <strong style={{ fontSize: '13.5px' }}>{profile?.phone || '0912-345-678'}</strong>
                </div>
                <div>
                  <small style={{ display: 'block', fontSize: '11px', color: '#8c8277' }}>Email</small>
                  <strong style={{ fontSize: '13px', wordBreak: 'break-all' }}>{profile?.email || user?.email}</strong>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Sticky Bottom Subtotal + Continue / Confirm Bar (Figma Screens 5 & 6) */}
      {enrichedItems.length > 0 && (
        <div className="sh-sticky-bar">
          <div className="sh-sticky-bar-inner">
            <div>
              <div style={{ fontSize: '11.5px', color: '#7c736a' }}>
                Subtotal ({enrichedItems.length} {enrichedItems.length === 1 ? 'item' : 'items'})
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#6e472a' }}>
                {formatVnd(subtotal)}
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                className="sh-btn-primary"
                style={{ minWidth: '148px' }}
                disabled={hasUnavailable || isAccountBlocked}
                onClick={handleContinueToConfirm}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="sh-btn-primary"
                style={{ minWidth: '148px' }}
                disabled={submitting}
                onClick={handleConfirmCheckout}
              >
                {submitting ? 'Confirming...' : 'Confirm'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
