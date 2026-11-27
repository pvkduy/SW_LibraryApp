import { supabase } from '../../../lib/supabase'

/**
 * Columns of `public.books` granted to the `authenticated` role.
 *
 * `embedding`, `embedding_hash` and `embedding_model` are deliberately NOT
 * granted (NFR-06: embeddings stay server-side), so `select('*')` fails with
 * 403 from PostgREST. Always select this explicit list instead.
 */
export const BOOK_COLUMNS = [
  'id',
  'title',
  'authors',
  'isbn10',
  'isbn13',
  'publisher',
  'year',
  'language',
  'category',
  'field',
  'description',
  'toc',
  'keywords',
  'collection',
  'replacement_price',
  'shelf_location',
  'cover_path',
  'status',
  'total_copies',
  'available_copies',
  'queue_length',
  'wishlist_count',
  'borrow_count',
  'rating_avg',
  'rating_count',
  'popularity_score',
  'added_at',
  'updated_at',
].join(', ')

export const BOOK_STATUSES = ['active', 'draft']
export const COLLECTIONS = [
  { value: 'standard', label: 'Standard', hint: 'Open 14-day borrowing' },
  { value: 'premium', label: 'Premium', hint: 'Fee 5,000đ / 7d' },
]
export const COPY_STATUSES = ['available', 'held', 'borrowed', 'damaged', 'under_repair', 'lost', 'retired']
export const EDITABLE_COPY_STATUSES = ['available', 'damaged', 'under_repair']
export const CONDITIONS = ['good', 'fair', 'poor', 'damaged']
export const WRITEOFF_REASONS = [
  { value: 'damaged_beyond_repair', label: 'Damage beyond repair', hint: 'Physical destruction, severe water damage, mildew' },
  { value: 'confirmed_missing', label: 'Confirmed missing', hint: 'Missing during shelf audit / stocktaking' },
  { value: 'obsolete_edition', label: 'Obsolete edition', hint: 'Superseded by current curriculum' },
]
export const HISTORY_GROUPS = [
  { value: 'all', label: 'All' },
  { value: 'batch_receipts', label: 'Batch receipts' },
  { value: 'manual_additions', label: 'Manual additions' },
  { value: 'stock_reductions', label: 'Stock reductions' },
  { value: 'status_changes', label: 'Status changes' },
]
export const TRANSACTION_TYPES = [
  'batch_receipt',
  'manual_addition',
  'found',
  'write_off',
  'lost',
  'status_change',
]

export function formatVnd(value) {
  if (value === null || value === undefined || value === '') return '—'
  return `${Number(value).toLocaleString('vi-VN')}đ`
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Short day/month label used by the write-off slip cards ("Created: 27 Nov"). */
export function formatShortDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function statusLabel(status) {
  return String(status ?? '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function statusTone(status) {
  switch (status) {
    case 'available':
    case 'active':
    case 'completed':
      return 'success'
    case 'borrowed':
    case 'under_repair':
      return 'info'
    case 'held':
    case 'ready_for_pickup':
      return 'warn'
    case 'damaged':
    case 'overdue':
      return 'danger'
    case 'lost':
    case 'retired':
    case 'cancelled':
      return 'muted'
    case 'draft':
    default:
      return 'neutral'
  }
}

export function transactionLabel(type) {
  switch (type) {
    case 'batch_receipt':
      return 'Batch Receipt'
    case 'manual_addition':
      return 'Manual Addition'
    case 'found':
      return 'Found'
    case 'write_off':
      return 'Stock Reduction'
    case 'lost':
      return 'Lost'
    case 'status_change':
      return 'Status Change'
    default:
      return statusLabel(type)
  }
}

export function transactionTone(type) {
  switch (type) {
    case 'batch_receipt':
    case 'manual_addition':
      return 'success'
    case 'found':
      return 'info'
    case 'write_off':
    case 'lost':
      return 'danger'
    case 'status_change':
      return 'warn'
    default:
      return 'neutral'
  }
}

export function bookShelf(book) {
  return book?.shelf_location || 'Unassigned'
}

export function copyShelf(copy, book) {
  return copy?.shelf_location || book?.shelf_location || 'Unassigned'
}

export function copyProgress(book) {
  const total = Number(book?.total_copies ?? 0)
  const available = Number(book?.available_copies ?? 0)
  return `${available} / ${total}`
}

/** Tone for the available/total ratio: none available, partly available, all available. */
export function copiesTone(book) {
  const total = Number(book?.total_copies ?? 0)
  const available = Number(book?.available_copies ?? 0)
  if (available <= 0) return 'danger'
  if (available < total) return 'warn'
  return 'success'
}

export function getCoverUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl
}

export async function uploadToBucket(bucket, folder, file) {
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${cleanName}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw new Error(error.message)
  return path
}

export function validateIsbn13(value) {
  const digits = String(value ?? '').replace(/[^0-9Xx]/g, '')
  if (digits.length !== 13) return false
  let sum = 0
  for (let index = 0; index < 12; index += 1) {
    sum += Number(digits[index]) * (index % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10 === Number(digits[12])
}

export function validateIsbn10(value) {
  const digits = String(value ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()
  if (digits.length !== 10) return false
  let sum = 0
  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index)
  }
  sum += digits[9] === 'X' ? 10 : Number(digits[9])
  return sum % 11 === 0
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                        */
/* -------------------------------------------------------------------------- */

export function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index]
    const next = clean[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((entry) => entry.some((cell) => String(cell).trim() !== ''))
}

export function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value)
  // Neutralize spreadsheet formula execution while keeping the value readable.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`
  return safe
}

export function toCsv(columns, rows) {
  const header = columns.map((column) => csvEscape(column.label)).join(',')
  const body = rows.map((row) => columns.map((column) => csvEscape(column.value(row))).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([`\uFEFF${text}`], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename, columns, rows) {
  downloadText(filename, toCsv(columns, rows))
}

export function downloadExcel(filename, title, columns, rows, meta = []) {
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

  const metaRows = meta.map(([label, value]) => `<tr><td colspan="2"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</td></tr>`).join('')
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')
  const body = rows.map((row) => `<tr>${columns.map((column) => {
    const value = column.value(row)
    return `<td style="mso-number-format:'\\@'">${escapeHtml(value)}</td>`
  }).join('')}</tr>`).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><table border="1"><tr><th colspan="${columns.length}"><h3>${escapeHtml(title)}</h3></th></tr>${metaRows}
<tr>${head}</tr>${body}</table></body></html>`

  downloadText(filename, html, 'application/vnd.ms-excel;charset=utf-8')
}

export function printHtml(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) return false
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #241e19; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #72685e; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f3eee7; border-bottom: 1px solid #dcd3c5; padding: 7px; }
  td { border-bottom: 1px solid #ede6db; padding: 7px; vertical-align: top; }
  .label-sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .label { border: 1px dashed #9d9388; border-radius: 8px; padding: 10px; page-break-inside: avoid; }
  .label .lib { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #6e472a; }
  .label .title { font-size: 12px; font-weight: 700; margin: 4px 0 2px; }
  .label .shelf { font-size: 10px; color: #72685e; }
  .label svg { width: 100%; height: 44px; margin-top: 6px; }
  .label .code { font-family: monospace; font-size: 11px; font-weight: 700; text-align: center; letter-spacing: .08em; }
  @media print { .no-print { display: none; } body { padding: 0; } }
</style></head><body>${bodyHtml}
<div class="no-print" style="margin-top:20px;text-align:right">
  <button onclick="window.print()" style="padding:8px 16px">Print / Save as PDF</button>
</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 250) })</script>
</body></html>`)
  win.document.close()
  return true
}

/* -------------------------------------------------------------------------- */
/* Code 128B barcode                                                          */
/* -------------------------------------------------------------------------- */

// Code 128 symbol patterns for values 0..106 (106 is the stop pattern).
const CODE128_BARS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011',
]

export function code128bSvg(value, { height = 44, moduleWidth = 1 } = {}) {
  const text = String(value ?? '')
  const values = [104] // START B
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code < 32 || code > 126) continue
    values.push(code - 32)
  }
  let checksum = 104
  for (let index = 0; index < values.length - 1; index += 1) {
    checksum += values[index + 1] * (index + 1)
  }
  values.push(checksum % 103, 106)

  const bits = values.map((value) => CODE128_BARS[value] ?? '').join('')
  const width = bits.length * moduleWidth
  const rects = []
  let index = 0
  while (index < bits.length) {
    if (bits[index] === '1') {
      let run = 1
      while (bits[index + run] === '1') run += 1
      rects.push(`<rect x="${index * moduleWidth}" y="0" width="${run * moduleWidth}" height="${height}" fill="#111" />`)
      index += run
    } else {
      index += 1
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Barcode ${text}">${rects.join('')}</svg>`
}

export function printBarcodeLabels(copies) {
  if (!copies.length) return false
  const labels = copies.map((copy) => {
    const title = copy.book_title || copy.books?.title || 'Untitled'
    const shelf = copy.shelf_location || copy.books?.shelf_location || 'Unassigned'
    const barcode = copy.barcode || ''
    return `<div class="label">
      <div class="lib">VNUHCM · University of Science Library</div>
      <div class="title">${escapeBarcodeHtml(title)}</div>
      <div class="shelf">${escapeBarcodeHtml(shelf)}</div>
      ${code128bSvg(barcode)}
      <div class="code">${escapeBarcodeHtml(barcode)}</div>
    </div>`
  }).join('')

  return printHtml('Barcode Labels', `<h1>Barcode label sheet</h1>
    <div class="meta">${copies.length} label(s) · Code 128 · ShelfHelp</div>
    <div class="label-sheet">${labels}</div>`)
}

function escapeBarcodeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/* -------------------------------------------------------------------------- */
/* CSV import parsing / validation                                            */
/* -------------------------------------------------------------------------- */

export const IMPORT_COLUMNS = [
  'isbn13',
  'title',
  'authors',
  'publisher',
  'year',
  'language',
  'category',
  'field',
  'collection',
  'description',
  'keywords',
  'replacement_price',
  'shelf_location',
  'copies',
]

const COLUMN_ALIASES = {
  isbn: 'isbn13',
  isbn_13: 'isbn13',
  author: 'authors',
  call_number: 'shelf_location',
  callnumber: 'shelf_location',
  initial_copies: 'copies',
  copies_count: 'copies',
  price: 'replacement_price',
  replacementprice: 'replacement_price',
}

const LIST_FIELDS = new Set(['authors', 'keywords'])

export function normalizeHeader(header) {
  const key = String(header ?? '').trim().toLowerCase().replace(/\s+/g, '_')
  return COLUMN_ALIASES[key] ?? key
}

export function buildImportPreview(text, fileName) {
  const rawRows = parseCsv(text)
  if (rawRows.length === 0) {
    return { fileName, totalRows: 0, headers: [], rows: [], errors: [{ row: 0, reason: 'The file is empty.' }], validRows: [] }
  }

  const headers = rawRows[0].map(normalizeHeader)
  const missing = ['title'].filter((column) => !headers.includes(column))
  if (missing.length > 0) {
    return {
      fileName,
      totalRows: Math.max(rawRows.length - 1, 0),
      headers,
      rows: [],
      errors: [{ row: 1, reason: `Missing required column: ${missing.join(', ')}` }],
      validRows: [],
    }
  }

  const seen = new Map()
  const rows = []
  const errors = []
  const validRows = []

  rawRows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2
    const parsed = {}
    headers.forEach((header, columnIndex) => {
      const value = String(cells[columnIndex] ?? '').trim()
      if (!header) return
      parsed[header] = LIST_FIELDS.has(header)
        ? value.split(/[;|]/).map((part) => part.trim()).filter(Boolean)
        : value
    })

    const rowErrors = []
    const title = String(parsed.title ?? '').trim()
    const isbn = String(parsed.isbn13 ?? '').replace(/[^0-9Xx]/g, '')

    if (!title) rowErrors.push('Title is required')
    if (isbn && !validateIsbn13(isbn)) rowErrors.push('Invalid ISBN-13 checksum')
    if (isbn && seen.has(isbn)) rowErrors.push(`Duplicate ISBN also on row ${seen.get(isbn)}`)
    if (isbn && !seen.has(isbn)) seen.set(isbn, rowNumber)

    if (parsed.year && !/^\d{4}$/.test(String(parsed.year))) rowErrors.push('Year must be four digits')
    if (parsed.collection && !['standard', 'premium'].includes(String(parsed.collection).toLowerCase())) {
      rowErrors.push('Collection must be standard or premium')
    }
    if (parsed.copies !== undefined && parsed.copies !== '' && !/^\d+$/.test(String(parsed.copies))) {
      rowErrors.push('Copies must be a whole number')
    }
    if (parsed.replacement_price !== undefined && parsed.replacement_price !== '' && !/^\d+$/.test(String(parsed.replacement_price))) {
      rowErrors.push('Replacement price must be a whole number (VND)')
    }

    const normalized = {
      row: rowNumber,
      title,
      authors: Array.isArray(parsed.authors) ? parsed.authors : [],
      isbn13: isbn || null,
      isbn10: parsed.isbn10 || null,
      publisher: parsed.publisher || null,
      year: parsed.year || null,
      language: parsed.language || null,
      category: parsed.category || null,
      field: parsed.field || null,
      collection: String(parsed.collection ?? 'standard').toLowerCase() || 'standard',
      description: parsed.description || null,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      replacement_price: parsed.replacement_price || null,
      shelf_location: parsed.shelf_location || null,
      copies: parsed.copies === '' || parsed.copies === undefined ? 1 : Number(parsed.copies),
    }

    rows.push({ ...normalized, valid: rowErrors.length === 0 })
    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, reason: rowErrors.join('; '), data: normalized })
    } else {
      validRows.push(normalized)
    }
  })

  return {
    fileName,
    totalRows: rawRows.length - 1,
    headers,
    rows,
    errors,
    validRows,
  }
}

export const IMPORT_TEMPLATE = `isbn13,title,authors,publisher,year,language,category,field,collection,description,keywords,replacement_price,shelf_location,copies
9780132350884,Clean Code,Robert C. Martin,Prentice Hall,2008,en,Computer Science,Software Engineering,standard,A handbook of agile software craftsmanship.,"software;craftsmanship",180000,CS-A1,2
`
