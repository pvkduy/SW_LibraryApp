import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useCart } from './useCart'
import { getGreeting, rankBooksClient } from './cartHelpers'
import {
  BarcodeIcon,
  HeartIcon,
  SearchIcon,
  ShelfBookLogo,
  SlidersIcon,
  SparklesIcon,
  StarIcon,
} from './CatalogIcons'
import './catalog.css'

const CATEGORY_PILLS = ['All', 'Fiction', 'Non-Fiction', 'Science', 'Computer Science', 'Natural Sciences', 'Arts']

/**
 * Figma Screen 2: Catalogue / Discover & Wishlist (R-05, R-06, FR-SRCH-01..04, FR-SRCH-06).
 */
export function CataloguePage({ profile, mode = 'discover', onOpenBook, onOpenScan }) {
  const { wishlistIds, toggleWishlist } = useCart()

  const [query, setQuery] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') || ''
  })
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [collectionFilter, setCollectionFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [yearMin, setYearMin] = useState('')
  const [yearMax, setYearMax] = useState('')
  const [sortBy, setSortBy] = useState('relevance')
  const [showFilters, setShowFilters] = useState(false)
  const [showAiHint, setShowAiHint] = useState(false)

  const [books, setBooks] = useState([])
  const [popularBooks, setPopularBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Debounce search input 250ms and sync query in URL (FR-SRCH-01)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
      if (typeof window !== 'undefined' && mode === 'discover') {
        const url = new URL(window.location.href)
        if (query.trim()) url.searchParams.set('q', query.trim())
        else url.searchParams.delete('q')
        window.history.replaceState({}, '', url.toString())
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query, mode])

  // Load "Popular This Week" independently (FR-HOME-01)
  useEffect(() => {
    let active = true
    supabase
      .from('books')
      .select('id, title, authors, collection, rating_avg, rating_count, available_copies, total_copies, cover_path, popularity_score, category')
      .eq('status', 'active')
      .order('popularity_score', { ascending: false })
      .order('added_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (active && data) setPopularBooks(data)
      })
    return () => {
      active = false
    }
  }, [])

  // Load main catalog via rpc_search_books (POL-17) with direct table fallback
  const fetchBooks = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcErr } = await supabase.rpc('rpc_search_books', {
        p_query: debouncedQuery.trim() || null,
        p_category: selectedCategory === 'All' ? null : selectedCategory,
        p_field: null,
        p_collection: collectionFilter || null,
        p_language: languageFilter || null,
        p_year_min: yearMin ? Number(yearMin) : null,
        p_year_max: yearMax ? Number(yearMax) : null,
        p_available_only: availableOnly,
        p_sort: sortBy,
        p_limit: 40,
        p_offset: 0,
      })

      if (!rpcErr && data) {
        setBooks(data)
        setLoading(false)
        return
      }

      // Fallback when migration 0005 RPC is not yet loaded in local DB
      let qBuilder = supabase
        .from('books')
        .select('id, title, authors, isbn10, isbn13, publisher, year, language, category, field, description, collection, shelf_location, cover_path, total_copies, available_copies, rating_avg, rating_count, popularity_score, added_at')
        .eq('status', 'active')

      if (selectedCategory !== 'All') qBuilder = qBuilder.ilike('category', selectedCategory)
      if (collectionFilter) qBuilder = qBuilder.eq('collection', collectionFilter)
      if (languageFilter) qBuilder = qBuilder.ilike('language', languageFilter)
      if (availableOnly) qBuilder = qBuilder.gt('available_copies', 0)
      if (yearMin) qBuilder = qBuilder.gte('year', Number(yearMin))
      if (yearMax) qBuilder = qBuilder.lte('year', Number(yearMax))

      const { data: fallbackData, error: fbErr } = await qBuilder.limit(60)
      if (fbErr) throw fbErr

      let list = fallbackData || []
      if (debouncedQuery.trim()) {
        list = rankBooksClient(list, debouncedQuery)
      }
      if (sortBy === 'rating') {
        list = [...list].sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0))
      } else if (sortBy === 'recency') {
        list = [...list].sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
      } else if (sortBy === 'popularity') {
        list = [...list].sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0))
      }
      setBooks(list)
    } catch (err) {
      setError(err.message || 'Search is temporarily limited. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, selectedCategory, collectionFilter, languageFilter, availableOnly, yearMin, yearMax, sortBy])

  useEffect(() => {
    const t = window.setTimeout(() => {
      fetchBooks()
    }, 0)
    return () => window.clearTimeout(t)
  }, [fetchBooks])

  const displayedBooks = useMemo(() => {
    if (mode === 'wishlist') {
      return books.filter((b) => wishlistIds.includes(b.id))
    }
    return books
  }, [books, mode, wishlistIds])

  const activeFilterChips = []
  if (selectedCategory !== 'All') activeFilterChips.push({ key: 'cat', label: selectedCategory, clear: () => setSelectedCategory('All') })
  if (collectionFilter) activeFilterChips.push({ key: 'col', label: collectionFilter === 'premium' ? 'Premium' : 'Standard', clear: () => setCollectionFilter('') })
  if (languageFilter) activeFilterChips.push({ key: 'lang', label: languageFilter, clear: () => setLanguageFilter('') })
  if (availableOnly) activeFilterChips.push({ key: 'avail', label: 'Available now', clear: () => setAvailableOnly(false) })
  if (yearMin || yearMax) {
    activeFilterChips.push({
      key: 'year',
      label: `Year: ${yearMin || '…'}–${yearMax || '…'}`,
      clear: () => {
        setYearMin('')
        setYearMax('')
      },
    })
  }

  const clearAllFilters = () => {
    setQuery('')
    setSelectedCategory('All')
    setCollectionFilter('')
    setLanguageFilter('')
    setAvailableOnly(false)
    setYearMin('')
    setYearMax('')
  }

  const renderBookCard = (book) => {
    const ratingVal = book.rating_avg ? Number(book.rating_avg).toFixed(1) : '4.8'
    const isOut = (book.available_copies ?? 0) <= 0
    const isSaved = wishlistIds.includes(book.id)

    return (
      <article
        key={book.id}
        className="sh-book-card"
        onClick={() => onOpenBook(book.id)}
      >
        <div className="sh-book-cover">
          {book.cover_path ? (
            <img src={book.cover_path} alt={book.title} />
          ) : (
            <ShelfBookLogo size={44} color="rgba(255,255,255,0.9)" />
          )}
          <span className={`sh-book-cover-avail ${isOut ? 'out' : ''}`}>
            {isOut ? 'On Loan' : `${book.available_copies} avail`}
          </span>
          {mode === 'wishlist' && (
            <button
              type="button"
              aria-label="Remove from wishlist"
              onClick={(e) => {
                e.stopPropagation()
                toggleWishlist(book.id)
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '32px',
                height: '32px',
                padding: 0,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.94)',
                color: '#c85a3e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <HeartIcon size={18} filled={isSaved} />
            </button>
          )}
        </div>

        <div className="sh-book-body">
          <h4 className="sh-book-title">{book.title}</h4>
          <p className="sh-book-author">{book.authors?.join(', ') || 'Unknown author'}</p>
          <div className="sh-book-meta">
            <span className="sh-rating-inline">
              <StarIcon size={12} />
              {ratingVal}
            </span>
            {book.collection === 'premium' && <span className="sh-badge-premium">Premium</span>}
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="sh-container">
      {mode === 'wishlist' ? (
        <div className="sh-greeting">
          <h2>My Wishlist ({displayedBooks.length})</h2>
          <p>Saved books &amp; notify-me alerts when copies return to shelf.</p>
        </div>
      ) : (
        <>
          {/* Search Bar with Scan ISBN & Filter Controls (Figma Screen 2) */}
          <div className="sh-search-wrap">
            <SearchIcon size={20} color="#8c8277" />
            <input
              type="search"
              className="sh-search-input"
              placeholder="Search books, authors, ISBN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search books, authors, ISBN"
            />
            <button
              type="button"
              className="sh-search-action"
              title="Scan ISBN Barcode"
              aria-label="Scan ISBN Barcode"
              onClick={onOpenScan}
            >
              <BarcodeIcon size={21} />
            </button>
            <button
              type="button"
              className={`sh-search-action ${showFilters ? 'active' : ''}`}
              title="Filter results"
              aria-label="Filter results"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersIcon size={20} />
            </button>
          </div>

          {/* Expandable Filters (FR-SRCH-02) */}
          {showFilters && (
            <div className="sh-filter-panel">
              <div className="sh-filter-group">
                <label htmlFor="flt-collection">Collection</label>
                <select
                  id="flt-collection"
                  value={collectionFilter}
                  onChange={(e) => setCollectionFilter(e.target.value)}
                >
                  <option value="">All Collections</option>
                  <option value="standard">Standard (Free)</option>
                  <option value="premium">Premium (5.000₫/7d)</option>
                </select>
              </div>
              <div className="sh-filter-group">
                <label htmlFor="flt-language">Language</label>
                <select
                  id="flt-language"
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                >
                  <option value="">All Languages</option>
                  <option value="English">English</option>
                  <option value="Vietnamese">Vietnamese</option>
                </select>
              </div>
              <div className="sh-filter-group">
                <label htmlFor="flt-ymin">Published From</label>
                <input
                  id="flt-ymin"
                  type="number"
                  placeholder="e.g. 2000"
                  value={yearMin}
                  onChange={(e) => setYearMin(e.target.value)}
                />
              </div>
              <div className="sh-filter-group">
                <label htmlFor="flt-ymax">Published To</label>
                <input
                  id="flt-ymax"
                  type="number"
                  placeholder="e.g. 2026"
                  value={yearMax}
                  onChange={(e) => setYearMax(e.target.value)}
                />
              </div>
              <div className="sh-filter-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    marginBottom: '8px',
                    fontSize: '13px',
                    color: '#241e19',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                  />
                  Available now only
                </label>
              </div>
            </div>
          )}

          {/* Greeting (Figma Screen 2) */}
          <div className="sh-greeting">
            <h2>{getGreeting(profile?.full_name)}</h2>
            <p>What would you like to read today?</p>
          </div>

          {/* Category Filter Pills (Figma Screen 2) */}
          <div className="sh-pill-row" role="tablist" aria-label="Book categories">
            {CATEGORY_PILLS.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat}
                className={`sh-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Active removable filter chips (FR-SRCH-02) */}
          {activeFilterChips.length > 0 && (
            <div className="sh-active-chips">
              {activeFilterChips.map((chip) => (
                <span key={chip.key} className="sh-chip">
                  {chip.label}
                  <button type="button" onClick={chip.clear} aria-label={`Remove ${chip.label}`}>
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6e472a',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Popular This Week Carousel (hidden while typing search query) */}
          {!debouncedQuery.trim() && selectedCategory === 'All' && popularBooks.length > 0 && (
            <section>
              <div className="sh-section-header">
                <h3>Popular This Week</h3>
              </div>
              <div className="sh-horizontal-scroll">
                {popularBooks.map((book) => renderBookCard(book))}
              </div>
            </section>
          )}
        </>
      )}

      {/* All Titles Grid + Sort By (FR-SRCH-03) */}
      <section>
        <div className="sh-section-header">
          <h3>
            {mode === 'wishlist'
              ? 'Saved Titles'
              : debouncedQuery.trim()
                ? `Results for "${debouncedQuery.trim()}" (${displayedBooks.length})`
                : 'All Titles'}
          </h3>
          {mode === 'discover' && (
            <select
              className="sh-sort-select"
              aria-label="Sort books"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="relevance">Sort by: Relevance</option>
              <option value="popularity">Sort by: Popular</option>
              <option value="rating">Sort by: Rating</option>
              <option value="recency">Sort by: Newest</option>
            </select>
          )}
        </div>

        {error && (
          <div className="sh-card" style={{ borderColor: '#f4c7c3', background: '#fff5f4', color: '#c5221f' }}>
            <strong>Search is temporarily limited:</strong> {error}{' '}
            <button
              type="button"
              onClick={fetchBooks}
              style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#6e472a', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p style={{ color: '#7c736a', textAlign: 'center', padding: '32px 0' }}>Loading catalog...</p>
        ) : displayedBooks.length === 0 ? (
          <div className="sh-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '15px' }}>
              {mode === 'wishlist' ? 'Your wishlist is empty.' : 'No books match your filters.'}
            </p>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#7c736a' }}>
              {mode === 'wishlist'
                ? 'Tap the heart button on any book detail page to save it here.'
                : 'Try adjusting your keywords, removing filters, or scanning an ISBN barcode.'}
            </p>
            {mode === 'discover' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button type="button" className="sh-btn-outline" onClick={clearAllFilters}>
                  Clear Filters
                </button>
                <button type="button" className="sh-btn-primary" onClick={onOpenScan}>
                  Scan ISBN
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="sh-book-grid">{displayedBooks.map((book) => renderBookCard(book))}</div>
        )}
      </section>

      {/* Floating ShelfHelp AI Button (Figma Screen 2) */}
      {mode === 'discover' && (
        <>
          <button
            type="button"
            className="sh-ai-fab"
            onClick={() => setShowAiHint((v) => !v)}
          >
            <SparklesIcon size={15} />
            ShelfHelp AI
          </button>

          {showAiHint && (
            <div
              className="sh-sheet-overlay"
              onClick={() => setShowAiHint(false)}
              role="dialog"
              aria-modal="true"
            >
              <div className="sh-sheet-card" onClick={(e) => e.stopPropagation()}>
                <div className="sh-sheet-header">
                  <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <SparklesIcon size={18} color="#6e472a" /> ShelfHelp AI Assistant
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAiHint(false)}
                    style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6e665e' }}
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: '#5b524a', lineHeight: 1.5 }}>
                  Ask ShelfHelp AI to recommend books from the library catalog for your research topic (Milestone 012-assistant).
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {['UX Design', 'Algorithms', 'Chemistry', 'Habits'].map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      className="sh-pill"
                      onClick={() => {
                        setQuery(topic)
                        setShowAiHint(false)
                      }}
                    >
                      Try "{topic}"
                    </button>
                  ))}
                </div>
                <button type="button" className="sh-btn-primary" style={{ width: '100%' }} onClick={() => setShowAiHint(false)}>
                  Got it
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
