import { useState } from 'react'

const RATING_LABELS = {
  1: 'Not for me',
  2: 'Could be better',
  3: 'It was okay',
  4: 'Really enjoyed it',
  5: 'Excellent read',
}

export function BookReviewPage({ loan, onBack, onSubmit }) {
  const [rating, setRating] = useState(0)
  const [headline, setHeadline] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const bookTitle = loan.copies?.books?.title || 'this book'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(loan.id, rating, headline.trim(), comment.trim())
      setSubmitted(true)
    } catch (submitError) {
      setError(submitError.message || 'Could not submit your review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="review-page">
        <button type="button" className="review-back-button" onClick={onBack}>‹ <span>My Loans</span></button>
        <div className="review-recorded">
          <div className="review-recorded-icon" aria-hidden="true">✓</div>
          <p className="review-eyebrow">THANK YOU FOR SHARING</p>
          <h1>Review Recorded</h1>
          <p>Your review helps other readers discover their next favorite book.</p>
          <div className="review-recorded-card">
            <div className="review-stars" aria-label={`${rating} out of 5 stars`}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</div>
            <strong>{headline}</strong>
            <p>{comment}</p>
            <small>{bookTitle}</small>
          </div>
          <button type="button" className="review-primary-button" onClick={onBack}>Back to My Loans</button>
        </div>
      </section>
    )
  }

  return (
    <section className="review-page">
      <button type="button" className="review-back-button" onClick={onBack}>‹ <span>My Loans</span></button>
      <div className="review-form-card">
        <p className="review-eyebrow">YOUR READING JOURNAL</p>
        <h1>Rate &amp; Review</h1>
        <p className="review-book-title">{bookTitle}</p>

        <form onSubmit={handleSubmit}>
          <fieldset className="review-rating-field">
            <legend>Your rating</legend>
            <div className="review-rating-buttons" role="group" aria-label="Choose a star rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={value <= rating ? 'selected' : ''}
                  aria-label={`${value} star${value === 1 ? '' : 's'}`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="review-rating-label">{RATING_LABELS[rating] || 'Tap a star to rate this book'}</span>
          </fieldset>

          <label className="review-field">
            <span>Review headline</span>
            <input
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              maxLength={80}
              placeholder="Sum up your review in a few words"
              required
            />
            <small>{headline.length}/80</small>
          </label>

          <label className="review-field">
            <span>Your review</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={5}
              placeholder="What did you think of the book? Share what stood out to you."
              required
            />
            <small>{comment.length}/500</small>
          </label>

          {error && <div className="review-error" role="alert">{error}</div>}
          <button type="submit" className="review-primary-button" disabled={submitting || !rating}>
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      </div>
    </section>
  )
}
