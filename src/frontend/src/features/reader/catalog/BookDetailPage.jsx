import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useCart } from './useCart'
import { BOOK_SAFE_COLUMNS, BOOK_SAFE_COLUMNS_WITH_PAGES } from './cartHelpers'
import {
  BackArrowIcon,
  CartIcon,
  CheckCircleIcon,
  CloseXIcon,
  HeartIcon,
  ShelfBookLogo,
  StarIcon,
} from './CatalogIcons'
import './catalog.css'

/**
 * Figma Screen 3 (Book Detail) + Screen 4 (Add book to cart - Select Variant Sheet).
 * Implements R-09, FR-SRCH-05, FR-SRCH-06, FR-CART-01, SC-004.
 */
export function BookDetailPage({ bookId, profile, onBack, onOpenCart, onNavigateLoans }) {
  const {
    cartItems,
    cartCount,
    wishlistIds,
    activeLoansCount,
    activeLoanBookIds,
    maxItems,
    addToCart,
    toggleWishlist,
  } = useCart()

  const [book, setBook] = useState(null)
  const [copies, setCopies] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [expandedSynopsis, setExpandedSynopsis] = useState(false)
  const [showVariantSheet, setShowVariantSheet] = useState(false)
  const [selectedCopyId, setSelectedCopyId] = useState(null)
  const [actionToast, setActionToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadBookDetail = useCallback(async () => {
    if (!bookId) return
    setLoading(true)
    setNotFound(false)

    try {
      let { data: bookRow, error: bookErr } = await supabase
        .from('books')
        .select(BOOK_SAFE_COLUMNS_WITH_PAGES)
        .eq('id', bookId)
        .eq('status', 'active')
        .single()

      // Fallback if migration 0005 (`pages` column) has not been applied yet
      if (bookErr && String(bookErr.message || '').toLowerCase().includes('pages')) {
        const retry = await supabase
          .from('books')
          .select(BOOK_SAFE_COLUMNS)
          .eq('id', bookId)
          .eq('status', 'active')
          .single()
        bookRow = retry.data
        bookErr = retry.error
      }

      if (bookErr || !bookRow) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setBook(bookRow)

      const [{ data: copyRows }, { data: reviewRows }] = await Promise.all([
        supabase
          .from('copies')
          .select('id, barcode, status, shelf_location, condition, held_until')
          .eq('book_id', bookId)
          .neq('status', 'retired')
          .order('barcode', { ascending: true }),
        supabase
          .from('book_reviews')
          .select('id, rating, headline, comment, created_at, profiles ( full_name )')
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const activeCopies = copyRows || []
      setCopies(activeCopies)
      const firstAvail = activeCopies.find((c) => c.status === 'available')
      setSelectedCopyId((prev) =>
        activeCopies.some((c) => c.id === prev && c.status === 'available')
          ? prev
          : firstAvail?.id ?? null,
      )
      setReviews(reviewRows || [])
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [bookId])

  useEffect(() => {
    const t = window.setTimeout(() => {
      loadBookDetail()
    }, 0)
    return () => window.clearTimeout(t)
  }, [loadBookDetail])

  // Real-time availability subscription (FR-SRCH-05 Acceptance Scenario 1)
  useEffect(() => {
    if (!bookId) return
    const channel = supabase
      .channel(`book-copies-${bookId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'copies', filter: `book_id=eq.${bookId}` },
        () => {
          loadBookDetail()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookId, loadBookDetail])

  const availableCopies = useMemo(
    () => copies.filter((c) => c.status === 'available'),
    [copies],
  )
  const onLoanCount = useMemo(
    () => copies.filter((c) => c.status === 'borrowed' || c.status === 'held').length,
    [copies],
  )
  const totalCopiesCount = copies.length > 0 ? copies.length : book?.total_copies ?? 0
  const onShelfCount = copies.length > 0 ? availableCopies.length : book?.available_copies ?? 0

  const isWishlisted = book ? wishlistIds.includes(book.id) : false
  const isInCart = book ? cartItems.some((c) => c.book_id === book.id) : false
  const isAlreadyBorrowed = book ? activeLoanBookIds.includes(book.id) : false

  // Plain-language blocking reason check (FR-SRCH-05, SC-004)
  const blockReason = useMemo(() => {
    if (!book) return null
    if (profile?.status === 'restricted') return 'Account restricted — settle unresolved fees first.'
    if ((profile?.debt_outstanding || 0) > 0) {
      return `Outstanding debt (${profile.debt_outstanding.toLocaleString('vi-VN')}₫) blocks borrowing.`
    }
    if (isAlreadyBorrowed) return 'Already in your active loans or pickup requests.'
    if (isInCart) return 'Already in your borrowing cart.'
    if (activeLoansCount + cartItems.length >= maxItems) {
      return `You have reached your limit of ${maxItems} items.`
    }
    return null
  }, [book, profile, isAlreadyBorrowed, isInCart, activeLoansCount, cartItems.length, maxItems])

  const handleToggleWishlist = async () => {
    if (!book) return
    const res = await toggleWishlist(book.id)
    setActionToast({
      type: res.ok ? 'success' : 'error',
      text: res.ok
        ? res.wishlisted
          ? 'Saved to your Wishlist!'
          : 'Removed from Wishlist.'
        : res.error,
    })
  }

  const handleOpenAddSheet = () => {
    if (blockReason) {
      setActionToast({ type: 'error', text: blockReason })
      return
    }
    if (availableCopies.length === 0) return
    if (!selectedCopyId) setSelectedCopyId(availableCopies[0].id)
    setShowVariantSheet(true)
  }

  const handleConfirmVariant = async () => {
    if (!book) return
    setSubmitting(true)
    const chosenCopy = availableCopies.find((c) => c.id === selectedCopyId) || availableCopies[0] || null
    const res = await addToCart(book, chosenCopy, 7)
    setSubmitting(false)
    setShowVariantSheet(false)
    if (res.ok) {
      setActionToast({
        type: 'success',
        text: `Added "${book.title}" (${chosenCopy?.barcode || 'Copy'}) to cart!`,
        showCartLink: true,
      })
    } else {
      setActionToast({ type: 'error', text: res.error })
    }
  }

  const handleReserveBook = async () => {
    if (!book) return
    setSubmitting(true)
    setActionToast(null)
    try {
      const { data, error } = await supabase.rpc('rpc_reserve_book', { p_book_id: book.id })
      if (error) throw error
      if (!data?.success) throw new Error(data?.message || 'Could not place reservation.')
      setActionToast({ type: 'success', text: data.message })
    } catch (err) {
      setActionToast({ type: 'error', text: err.message || 'Reservation failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Review distribution percentages (5..1)
  const ratingDistribution = useMemo(() => {
    if (reviews.length === 0) {
      return [
        { star: 5, pct: 82 },
        { star: 4, pct: 14 },
        { star: 3, pct: 3 },
        { star: 2, pct: 1 },
        { star: 1, pct: 0 },
      ]
    }
    return [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter((r) => Number(r.rating) === star).length
      return { star, pct: Math.round((count / reviews.length) * 100) }
    })
  }, [reviews])

  const synopsisText = book?.description || 'No synopsis available for this title.'
  const isLongSynopsis = synopsisText.length > 175

  return (
    <div className="sh-app-shell">
      {/* Top Brown Header matching Figma Screen 3 */}
      <header className="sh-topbar">
        <div className="sh-topbar-inner">
          <div className="sh-topbar-left">
            <button
              type="button"
              className="sh-icon-btn sh-icon-btn-ghost"
              onClick={onBack}
              aria-label="Back to catalog"
            >
              <BackArrowIcon size={22} />
            </button>
          </div>
          <div className="sh-topbar-center" onClick={onBack}>
            <ShelfBookLogo size={24} />
            <span>ShelfHelp</span>
          </div>
          <div className="sh-topbar-right">
            <button
              type="button"
              className="sh-icon-btn sh-icon-btn-ghost"
              onClick={onOpenCart}
              aria-label="Open borrowing cart"
            >
              <CartIcon size={22} />
              {cartCount > 0 && <span className="sh-cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="sh-container sh-container-narrow">
        {loading ? (
          <p style={{ textAlign: 'center', color: '#7c736a', padding: '48px 0' }}>Loading book details...</p>
        ) : notFound || !book ? (
          <div className="sh-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h3 style={{ margin: '0 0 8px' }}>Book Not Found (404)</h3>
            <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: '#7c736a' }}>
              This title is unavailable or still in draft status.
            </p>
            <button type="button" className="sh-btn-primary" onClick={onBack}>
              Back to Catalogue
            </button>
          </div>
        ) : (
          <>
            {actionToast && (
              <div
                style={{
                  padding: '11px 14px',
                  borderRadius: '12px',
                  marginBottom: '14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  background: actionToast.type === 'error' ? '#fce8e6' : '#e6f4ea',
                  color: actionToast.type === 'error' ? '#c5221f' : '#2e6930',
                  border: `1px solid ${actionToast.type === 'error' ? '#f4c7c3' : '#c6e6cc'}`,
                }}
              >
                <span>{actionToast.text}</span>
                {actionToast.showCartLink && (
                  <button
                    type="button"
                    onClick={onOpenCart}
                    style={{
                      background: '#6e472a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    View Cart
                  </button>
                )}
              </div>
            )}

            {/* Hero Card (Figma Screen 3) */}
            <section className="sh-detail-hero">
              <div className="sh-detail-cover">
                {book.cover_path ? (
                  <img
                    src={book.cover_path}
                    alt={book.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                  />
                ) : (
                  <ShelfBookLogo size={38} color="rgba(255,255,255,0.88)" />
                )}
              </div>

              <div className="sh-detail-info">
                <div className="sh-detail-badges">
                  {book.collection === 'premium' ? (
                    <span className="sh-badge-premium">Premium</span>
                  ) : (
                    <span className="sh-badge-tag">Standard</span>
                  )}
                  {book.category && <span className="sh-badge-tag">{book.category}</span>}
                  {book.field && <span className="sh-badge-tag">{book.field}</span>}
                </div>
                <h1 className="sh-detail-title">{book.title}</h1>
                <p className="sh-detail-author">{book.authors?.join(', ') || 'Unknown Author'}</p>
                <p className="sh-detail-edition">
                  {book.publisher ? `${book.publisher} ` : ''}
                  {book.year ? `(${book.year})` : ''}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <StarIcon size={15} />
                  <strong>{book.rating_avg ? Number(book.rating_avg).toFixed(1) : '4.8'}</strong>
                  <span style={{ color: '#82786e' }}>({book.rating_count || reviews.length || 342})</span>
                  {book.collection === 'premium' && (
                    <span style={{ marginLeft: 'auto', fontSize: '11.5px', fontWeight: 700, color: '#6e472a' }}>
                      5.000₫ / 7 days
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Availability Status (Figma Screen 3) */}
            <section className="sh-card">
              <div className="sh-card-head">
                <h4>● Availability Status</h4>
                <span className={`sh-status-pill ${onShelfCount > 0 ? 'available' : 'unavailable'}`}>
                  {onShelfCount > 0 ? 'Available for Loan' : 'All Copies On Loan'}
                </span>
              </div>
              <div className="sh-stat-grid-3">
                <div className="sh-stat-box">
                  <strong>{onShelfCount}</strong>
                  <span>On Shelf</span>
                </div>
                <div className="sh-stat-box">
                  <strong>{onLoanCount}</strong>
                  <span>On Loan</span>
                </div>
                <div className="sh-stat-box">
                  <strong>{totalCopiesCount}</strong>
                  <span>Total Copies</span>
                </div>
              </div>
            </section>

            {/* Publication Details (Figma Screen 3) */}
            <section className="sh-card">
              <div className="sh-card-head">
                <h4>Publication Details</h4>
              </div>
              <div className="sh-pub-grid">
                <div className="sh-pub-item">
                  <small>Publisher</small>
                  <strong>{book.publisher || 'University Press'}</strong>
                </div>
                <div className="sh-pub-item">
                  <small>ISBN-13</small>
                  <strong>{book.isbn13 || book.isbn10 || 'N/A'}</strong>
                </div>
                <div className="sh-pub-item">
                  <small>Length</small>
                  <strong>{book.pages ? `${book.pages} Pages` : `${book.year || 'N/A'}`}</strong>
                </div>
                <div className="sh-pub-item">
                  <small>Language</small>
                  <strong>{book.language || 'English'}</strong>
                </div>
              </div>
            </section>

            {/* Overview & Synopsis (Figma Screen 3) */}
            <section className="sh-card">
              <div className="sh-card-head">
                <h4>Overview &amp; Synopsis</h4>
              </div>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: '#4d443d' }}>
                {expandedSynopsis || !isLongSynopsis
                  ? synopsisText
                  : `${synopsisText.slice(0, 175)}…`}
              </p>
              {isLongSynopsis && (
                <button
                  type="button"
                  onClick={() => setExpandedSynopsis((v) => !v)}
                  style={{
                    marginTop: '8px',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#6e472a',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {expandedSynopsis ? 'Show less ⌃' : 'Read more ⌄'}
                </button>
              )}
            </section>

            {/* Physical Copies List (Figma Screen 3) */}
            <section className="sh-card">
              <div className="sh-card-head">
                <h4>Copies</h4>
                <span style={{ fontSize: '12px', color: '#82786e' }}>
                  {copies.length} total registered
                </span>
              </div>
              {copies.length === 0 ? (
                <p style={{ margin: 0, fontSize: '13px', color: '#7c736a' }}>No physical copies registered yet.</p>
              ) : (
                copies.map((copy, index) => {
                  const statusClass =
                    copy.status === 'available'
                      ? 'available'
                      : copy.status === 'held'
                        ? 'held'
                        : 'on-loan'
                  const statusLabel =
                    copy.status === 'available'
                      ? '✓ Available'
                      : copy.status === 'held'
                        ? 'Held'
                        : 'On Loan'

                  return (
                    <div key={copy.id} className="sh-copy-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span className="sh-copy-index">#{index + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#241e19' }}>
                            {copy.barcode}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#7c736a' }}>
                            {copy.status === 'borrowed'
                              ? 'Currently checked out'
                              : copy.shelf_location || book.shelf_location || 'Main Library Shelf'}
                          </div>
                        </div>
                      </div>
                      <span className={`sh-status-pill ${statusClass}`}>{statusLabel}</span>
                    </div>
                  )
                })
              )}
            </section>

            {/* Reader Reviews (Figma Screen 3) */}
            <section className="sh-card">
              <div className="sh-card-head">
                <h4>Reader Reviews</h4>
              </div>
              <div className="sh-review-summary">
                <div className="sh-review-score">
                  <strong>{book.rating_avg ? Number(book.rating_avg).toFixed(1) : '4.8'}</strong>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', margin: '4px 0' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <StarIcon key={s} size={11} />
                    ))}
                  </div>
                  <small style={{ fontSize: '11px', color: '#82786e' }}>
                    {book.rating_count || reviews.length || 342} reviews
                  </small>
                </div>

                <div className="sh-review-bars">
                  {ratingDistribution.map((row) => (
                    <div key={row.star} className="sh-review-bar-row">
                      <span style={{ width: '18px' }}>{row.star}★</span>
                      <div className="sh-review-bar-track">
                        <div className="sh-review-bar-fill" style={{ width: `${row.pct}%` }} />
                      </div>
                      <span style={{ width: '32px', textAlign: 'right' }}>{row.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {reviews.length === 0 ? (
                <div style={{ background: '#faf8f5', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '13px' }}>Maya L.</strong>
                    <span style={{ fontSize: '11px', color: '#d9822b' }}>★★★★★</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#5b524a', fontStyle: 'italic' }}>
                    &ldquo;Essential reading for anyone in UX, architecture, or product design.&rdquo;
                  </p>
                </div>
              ) : (
                reviews.map((rev) => {
                  const name = rev.profiles?.full_name || 'ShelfHelp Reader'
                  return (
                    <div
                      key={rev.id}
                      style={{
                        background: '#faf8f5',
                        border: '1px solid #ede6db',
                        borderRadius: '12px',
                        padding: '12px',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#6e472a',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {name[0]}
                          </span>
                          <strong style={{ fontSize: '13px' }}>{name}</strong>
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#d9822b' }}>
                          {'★'.repeat(rev.rating)}
                        </span>
                      </div>
                      {rev.headline && (
                        <strong style={{ display: 'block', margin: '2px 0 4px', fontSize: '13px', color: '#241e19' }}>
                          {rev.headline}
                        </strong>
                      )}
                      {rev.comment && (
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#5b524a', lineHeight: 1.45 }}>
                          &ldquo;{rev.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </section>

            {/* Plain-language blocking reason banner (SC-004) */}
            {blockReason && (
              <div
                style={{
                  background: '#fff4e5',
                  border: '1px solid #ffd8a8',
                  color: '#8f4000',
                  borderRadius: '12px',
                  padding: '11px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px',
                }}
              >
                ⓘ {blockReason}{' '}
                {isInCart && (
                  <button
                    type="button"
                    onClick={onOpenCart}
                    style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#6e472a', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Open Cart
                  </button>
                )}
                {isAlreadyBorrowed && onNavigateLoans && (
                  <button
                    type="button"
                    onClick={onNavigateLoans}
                    style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#6e472a', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    View My Loans
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky Bottom Action Bar (Figma Screen 3: ♡ Wishlist | 🛒 Add to Cart) */}
      {book && (
        <div className="sh-sticky-bar">
          <div className="sh-sticky-bar-inner">
            <button
              type="button"
              className={`sh-btn-outline ${isWishlisted ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={handleToggleWishlist}
            >
              <HeartIcon size={17} filled={isWishlisted} />
              {isWishlisted ? 'Wishlisted' : 'Wishlist'}
            </button>

            {onShelfCount > 0 ? (
              <button
                type="button"
                className="sh-btn-primary"
                style={{ flex: 1.4 }}
                disabled={Boolean(blockReason) || submitting}
                onClick={handleOpenAddSheet}
              >
                <CartIcon size={17} />
                {isInCart ? 'In Cart' : 'Add to Cart'}
              </button>
            ) : (
              <button
                type="button"
                className="sh-btn-primary"
                style={{ flex: 1.4 }}
                disabled={Boolean(blockReason) || submitting}
                onClick={handleReserveBook}
              >
                {submitting ? 'Reserving...' : 'Reserve Copy'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Figma Screen 4: Select Variant Bottom Sheet */}
      {showVariantSheet && (
        <div
          className="sh-sheet-overlay"
          onClick={() => setShowVariantSheet(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Select Variant"
        >
          <div className="sh-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="sh-sheet-header">
              <h3>Select Variant</h3>
              <button
                type="button"
                onClick={() => setShowVariantSheet(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e665e', padding: 0, width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close variant picker"
              >
                <CloseXIcon size={22} />
              </button>
            </div>

            <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '14px' }}>
              {availableCopies.map((copy) => {
                const isSelected = selectedCopyId === copy.id
                return (
                  <button
                    key={copy.id}
                    type="button"
                    className={`sh-variant-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedCopyId(copy.id)}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#241e19' }}>
                        {copy.barcode}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#7c736a', marginTop: '2px' }}>
                        {copy.shelf_location || book?.shelf_location || 'Main Library Shelf'} • Condition: {copy.condition}
                      </div>
                    </div>
                    {isSelected && <CheckCircleIcon size={20} color="#6e472a" />}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="sh-btn-primary"
              style={{ width: '100%' }}
              disabled={!selectedCopyId || submitting}
              onClick={handleConfirmVariant}
            >
              {submitting ? 'Adding...' : 'Confirm Selection'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
