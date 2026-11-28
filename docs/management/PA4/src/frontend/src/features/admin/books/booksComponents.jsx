import React from 'react'
import {
  IconAlert,
  IconArchive,
  IconBook,
  IconCheckCircle,
  IconCopies,
  IconHistory,
  IconUpload,
} from './booksIcons'

const TAB_ICONS = {
  catalog: IconBook,
  copies: IconCopies,
  import: IconUpload,
  history: IconHistory,
  writeoffs: IconArchive,
}

/**
 * Inline notice used across the books page. Optional title + detail is the
 * pattern the prototypes use for validation and mandatory-reason messages.
 */
export function BooksAlert({ tone = 'error', title, message, onDismiss }) {
  const Icon = tone === 'error' ? IconAlert : IconCheckCircle
  return (
    <div className={`books-alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="books-alert-icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="books-alert-body">
        {title && <strong className="books-alert-title">{title}</strong>}
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button type="button" className="books-alert-dismiss" aria-label="Dismiss message" onClick={onDismiss}>
          ✕
        </button>
      )}
    </div>
  )
}

/** A tab in the books page switcher: icon, label and optional count. */
export function TabIcon({ tab }) {
  const Icon = TAB_ICONS[tab] ?? IconBook
  return <Icon size={14} />
}
