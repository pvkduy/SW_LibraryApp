/**
 * Browser-side Catalog & Cart helpers mirroring @shelfhelp/shared/src/domain/catalog.ts
 * (POL-04, POL-05, POL-17, FR-SRCH-01, FR-SRCH-07, FR-CART-02).
 */

export const NONMEMBER_MAX_ITEMS = 3
export const PREMIUM_FEE_PER_7_DAYS = 5000
export const ALLOWED_DURATIONS = [7, 14]
export const WISHLIST_MAX = 50

/**
 * Explicit column list granted to `authenticated` in 0001_init.sql (excludes `embedding*` columns).
 * Never use `.select('*')` on `books` because Postgres rejects `embedding` with 42501.
 */
export const BOOK_SAFE_COLUMNS =
  'id, title, authors, isbn10, isbn13, publisher, year, language, category, field, description, toc, keywords, collection, replacement_price, shelf_location, cover_path, status, total_copies, available_copies, queue_length, wishlist_count, borrow_count, rating_avg, rating_count, popularity_score, added_at, updated_at'

export const BOOK_SAFE_COLUMNS_WITH_PAGES = `${BOOK_SAFE_COLUMNS}, pages`

const VI_TONE_CLUSTERS = [
  ['oà', 'òa'],
  ['oá', 'óa'],
  ['oả', 'ỏa'],
  ['oã', 'õa'],
  ['oạ', 'ọa'],
  ['oè', 'òe'],
  ['oé', 'óe'],
  ['oẻ', 'ỏe'],
  ['oẽ', 'õe'],
  ['oẹ', 'ọe'],
  ['uỳ', 'ùy'],
  ['uý', 'úy'],
  ['uỷ', 'ủy'],
  ['uỹ', 'ũy'],
  ['uỵ', 'ụy'],
]

export function normalizeViExact(input) {
  if (!input) return ''
  let out = String(input).normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')
  for (const [oldForm, newForm] of VI_TONE_CLUSTERS) {
    if (out.includes(oldForm)) out = out.split(oldForm).join(newForm)
  }
  return out
}

export function stripDiacritics(input) {
  if (!input) return ''
  return normalizeViExact(input)
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
}

export function normalizeIsbn(raw) {
  return String(raw || '').replace(/[-\s]/g, '').toUpperCase()
}

export function validateIsbn13Checksum(raw) {
  const clean = normalizeIsbn(raw)
  if (!/^(978|979)\d{10}$/.test(clean)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(clean[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10 === Number(clean[12])
}

export function isValidIsbn(raw) {
  const clean = normalizeIsbn(raw)
  if (clean.length === 13) return validateIsbn13Checksum(clean)
  if (clean.length === 10 && /^\d{9}[\dX]$/.test(clean)) {
    let sum = 0
    for (let i = 0; i < 9; i++) sum += Number(clean[i]) * (10 - i)
    const last = clean[9] === 'X' ? 10 : Number(clean[9])
    return (sum + last) % 11 === 0
  }
  return false
}

export function calculateLineFee(collection, durationDays = 7, isMember = false) {
  if (collection !== 'premium' || isMember) return 0
  const blocks = Math.max(1, Math.ceil(durationDays / 7))
  return blocks * PREMIUM_FEE_PER_7_DAYS
}

export function formatVnd(amount, zeroLabel = 'Free') {
  if (!amount || amount <= 0) return zeroLabel
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`
}

export function getGreeting(fullName) {
  const hour = new Date().getHours()
  const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = fullName ? fullName.trim().split(/\s+/)[0] : 'Reader'
  return `${salutation}, ${firstName}`
}

/** Client-side POL-17 fallback ranker when rpc_search_books is not yet migrated */
export function rankBooksClient(books, query) {
  const qRaw = String(query || '').trim()
  if (!qRaw) return books
  const qExact = normalizeViExact(qRaw)
  const qUnacc = stripDiacritics(qRaw)
  const qIsbn = normalizeIsbn(qRaw)

  return books
    .map((book) => {
      const titleExact = normalizeViExact(book.title || '')
      const titleUnacc = stripDiacritics(book.title || '')
      const authorExact = normalizeViExact((book.authors || []).join(' '))
      const authorUnacc = stripDiacritics((book.authors || []).join(' '))
      const isbn13 = normalizeIsbn(book.isbn13 || '')
      const isbn10 = normalizeIsbn(book.isbn10 || '')

      let score = 0
      if (qIsbn && (isbn13 === qIsbn || isbn10 === qIsbn)) score += 1000
      if (titleExact.includes(qExact)) score += 500
      if (authorExact.includes(qExact)) score += 350
      if (titleUnacc.includes(qUnacc)) score += 150
      if (authorUnacc.includes(qUnacc)) score += 100

      return { book, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.book)
}
