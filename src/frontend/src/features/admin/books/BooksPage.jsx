import React, { useEffect, useState } from 'react'
import './books.css'
import { supabase } from '../../../lib/supabase'
import { CatalogTab } from './CatalogTab'
import { CopiesTab } from './CopiesTab'
import { ImportTab } from './ImportTab'
import { HistoryTab } from './HistoryTab'
import { WriteoffsTab } from './WriteoffsTab'

export function BooksPage() {
  const [activeTab, setActiveTab] = useState('catalog') // 'catalog' | 'copies' | 'import' | 'history' | 'writeoffs'
  const [focusBookId, setFocusBookId] = useState(null)

  // Quick summary counts
  const [counts, setCounts] = useState({
    books: null,
    copies: null,
    draftWriteoffs: null,
  })

  useEffect(() => {
    let mounted = true
    async function loadCounts() {
      try {
        const [{ count: booksCount }, { count: copiesCount }, { count: writeoffCount }] = await Promise.all([
          supabase.from('books').select('id', { count: 'exact', head: true }),
          supabase.from('copies').select('id', { count: 'exact', head: true }),
          supabase.from('writeoff_slips').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        ])
        if (mounted) {
          setCounts({
            books: booksCount ?? null,
            copies: copiesCount ?? null,
            draftWriteoffs: writeoffCount ?? null,
          })
        }
      } catch {
        // non-blocking
      }
    }
    loadCounts()
    return () => {
      mounted = false
    }
  }, [activeTab])

  const handleOpenCopiesForBook = (bookId) => {
    setFocusBookId(bookId)
    setActiveTab('copies')
  }

  const handleClearFocusBook = () => {
    setFocusBookId(null)
  }

  const handleOpenCatalogForBook = () => {
    setActiveTab('catalog')
  }

  const handleOpenWriteoff = () => {
    setActiveTab('writeoffs')
  }

  const handleImportCompleted = () => {
    setActiveTab('catalog')
  }

  return (
    <div className="books-page-container">
      {/* Top Header & Tab Selector (Matches Admin Design System) */}
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-title">Books & Inventory</h1>
          <div className="admin-page-desc">
            Physical inventory, catalog metadata, copy lifecycle, batch import, and decommissioning
          </div>
        </div>
      </div>

      {/* Top Tab Switcher */}
      <div className="admin-filter-tabs books-tab-switcher">
          <button
            type="button"
            className={`admin-pill-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <span>Books & Catalog</span>
            {counts.books !== null && <span className="admin-pill-count">{counts.books}</span>}
          </button>
          <button
            type="button"
            className={`admin-pill-btn ${activeTab === 'copies' ? 'active' : ''}`}
            onClick={() => setActiveTab('copies')}
          >
            <span>Copies</span>
            {counts.copies !== null && <span className="admin-pill-count">{counts.copies}</span>}
          </button>
          <button
            type="button"
            className={`admin-pill-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            className={`admin-pill-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span>History</span>
          </button>
          <button
            type="button"
            className={`admin-pill-btn ${activeTab === 'writeoffs' ? 'active' : ''}`}
            onClick={() => setActiveTab('writeoffs')}
          >
            <span>Write-offs</span>
            {counts.draftWriteoffs ? (
              <span className="admin-pill-count" style={{ background: '#d97706', color: '#fff' }}>
                {counts.draftWriteoffs}
              </span>
            ) : null}
          </button>
        </div>

      {/* Main Tab Content */}
      {activeTab === 'catalog' && (
        <CatalogTab onOpenCopies={handleOpenCopiesForBook} />
      )}

      {activeTab === 'copies' && (
        <CopiesTab focusBookId={focusBookId} onClearFocus={handleClearFocusBook} />
      )}

      {activeTab === 'import' && (
        <ImportTab onImported={handleImportCompleted} />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          onOpenWriteoff={handleOpenWriteoff}
          onOpenCatalog={handleOpenCatalogForBook}
        />
      )}

      {activeTab === 'writeoffs' && (
        <WriteoffsTab onOpenCopies={handleOpenCopiesForBook} />
      )}
    </div>
  )
}
