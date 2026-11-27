import React, { useEffect, useState } from 'react'
import './books.css'
import { supabase } from '../../../lib/supabase'
import { CatalogTab } from './CatalogTab'
import { CopiesTab } from './CopiesTab'
import { ImportTab } from './ImportTab'
import { HistoryTab } from './HistoryTab'
import { WriteoffsTab } from './WriteoffsTab'
import { TabIcon } from './booksComponents'

export function BooksPage() {
  const [activeTab, setActiveTab] = useState('catalog') // 'catalog' | 'copies' | 'import' | 'history' | 'writeoffs'
  const [focusBookId, setFocusBookId] = useState(null)
  const [focusCatalogBookId, setFocusCatalogBookId] = useState(null)
  const [focusSlipId, setFocusSlipId] = useState(null)

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

  const handleOpenCatalogForBook = (bookId) => {
    setFocusCatalogBookId(bookId ?? null)
    setActiveTab('catalog')
  }

  const handleOpenWriteoff = (slipId) => {
    setFocusSlipId(slipId ?? null)
    setActiveTab('writeoffs')
  }

  const handleImportCompleted = () => {
    setActiveTab('catalog')
  }

  return (
    <div className="books-page-container">
      {/* Top Header & Tab Selector (Matches Admin Design System) */}
      <div className="admin-page-title-row books-title-row">
        <div className="books-title-block">
          <h1 className="admin-page-title">Books & Inventory</h1>
          <div className="admin-page-desc">
            Physical inventory, catalog metadata, copy lifecycle, batch import, and decommissioning
          </div>
        </div>
        <div className="books-title-badges" aria-label="Inventory scope">
          <span className="books-scope-chip">
            <i className="books-scope-dot" aria-hidden="true" /> FR-INV-01…07
          </span>
        </div>
      </div>

      {/* Top Tab Switcher */}
      <div className="admin-filter-tabs books-tab-switcher">
        <button
          type="button"
          className={`admin-pill-btn ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          <TabIcon tab="catalog" />
          <span>Books & Catalog</span>
          {counts.books !== null && <span className="admin-pill-count">{counts.books.toLocaleString('vi-VN')}</span>}
        </button>
        <button
          type="button"
          className={`admin-pill-btn ${activeTab === 'copies' ? 'active' : ''}`}
          onClick={() => setActiveTab('copies')}
        >
          <TabIcon tab="copies" />
          <span>Copies</span>
          {counts.copies !== null && <span className="admin-pill-count">{counts.copies.toLocaleString('vi-VN')}</span>}
        </button>
        <button
          type="button"
          className={`admin-pill-btn ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          <TabIcon tab="import" />
          <span>Import CSV</span>
        </button>
        <button
          type="button"
          className={`admin-pill-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <TabIcon tab="history" />
          <span>History</span>
        </button>
        <button
          type="button"
          className={`admin-pill-btn ${activeTab === 'writeoffs' ? 'active' : ''}`}
          onClick={() => setActiveTab('writeoffs')}
        >
          <TabIcon tab="writeoffs" />
          <span>Write-offs</span>
          {counts.draftWriteoffs ? (
            <span className="admin-pill-count is-alert">{counts.draftWriteoffs}</span>
          ) : null}
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'catalog' && (
        <CatalogTab
          focusBookId={focusCatalogBookId}
          onClearFocusBook={() => setFocusCatalogBookId(null)}
          onOpenCopies={handleOpenCopiesForBook}
        />
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
        <WriteoffsTab
          focusSlipId={focusSlipId}
          onClearFocusSlip={() => setFocusSlipId(null)}
          onOpenCopies={handleOpenCopiesForBook}
        />
      )}
    </div>
  )
}
