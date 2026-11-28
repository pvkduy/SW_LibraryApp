/**
 * Edge Function: lookup-isbn (FR-INV-01, UC-19 step 4)
 *
 * Google Books first, Open Library fallback. A lookup failure is not an error
 * for the form: the client keeps the typed ISBN and falls back to manual entry.
 * Hard failures still return NOT_FOUND so the UI can show its warning banner.
 */
import { fail, handleOptions, json } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'

type IsbnMetadata = {
  title: string
  authors: string[]
  isbn10: string | null
  isbn13: string | null
  publisher: string | null
  year: number | null
  language: string | null
  category: string | null
  description: string | null
  cover_url: string | null
  source: 'google_books' | 'open_library'
}

function normalizeIsbn(raw: string): string | null {
  const digits = raw.replace(/[^0-9Xx]/g, '').toUpperCase()
  if (digits.length === 13) return digits
  if (digits.length === 10) return digits
  return null
}

function parseYear(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = value.match(/\d{4}/)
  return match ? Number(match[0]) : null
}

async function fetchJson(url: string, timeoutMs = 4000): Promise<any | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function googleBooksResult(payload: any): IsbnMetadata | null {
  const info = payload?.items?.[0]?.volumeInfo
  if (!info || typeof info.title !== 'string') return null

  const identifiers: Array<{ type?: string; identifier?: string }> = info.industryIdentifiers ?? []
  const isbn13 = identifiers.find((item) => item.type === 'ISBN_13')?.identifier ?? null
  const isbn10 = identifiers.find((item) => item.type === 'ISBN_10')?.identifier ?? null

  return {
    title: info.title,
    authors: Array.isArray(info.authors) ? info.authors.filter((a: unknown) => typeof a === 'string') : [],
    isbn10,
    isbn13,
    publisher: typeof info.publisher === 'string' ? info.publisher : null,
    year: parseYear(info.publishedDate),
    language: typeof info.language === 'string' ? info.language : null,
    category: Array.isArray(info.categories) && typeof info.categories[0] === 'string'
      ? info.categories[0]
      : null,
    description: typeof info.description === 'string' ? info.description : null,
    cover_url: typeof info.imageLinks?.thumbnail === 'string'
      ? info.imageLinks.thumbnail.replace('http://', 'https://')
      : null,
    source: 'google_books',
  }
}

function openLibraryResult(payload: any): IsbnMetadata | null {
  const key = Object.keys(payload ?? {})[0]
  const entry = key ? payload[key] : null
  if (!entry || typeof entry.title !== 'string') return null

  const authors = Array.isArray(entry.authors)
    ? entry.authors.map((a: any) => a?.name).filter((a: unknown) => typeof a === 'string')
    : []
  const publishers = Array.isArray(entry.publishers)
    ? entry.publishers.map((p: any) => p?.name).filter((p: unknown) => typeof p === 'string')
    : []
  const subjects = Array.isArray(entry.subjects)
    ? entry.subjects.map((s: any) => s?.name).filter((s: unknown) => typeof s === 'string')
    : []
  const identifiers = entry.identifiers ?? {}

  return {
    title: entry.title,
    authors,
    isbn10: Array.isArray(identifiers.isbn_10) ? identifiers.isbn_10[0] ?? null : null,
    isbn13: Array.isArray(identifiers.isbn_13) ? identifiers.isbn_13[0] ?? null : null,
    publisher: publishers[0] ?? null,
    year: parseYear(entry.publish_date),
    language: null,
    category: subjects[0] ?? null,
    description: typeof entry.notes === 'string' ? entry.notes : null,
    cover_url: typeof entry.cover?.medium === 'string' ? entry.cover.medium : null,
    source: 'open_library',
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions()
  if (req.method !== 'POST') return fail('VALIDATION_FAILED', 'Method must be POST')

  const auth = await requireAdmin(req)
  if (auth.errorResponse) return auth.errorResponse

  let body: any
  try {
    body = await req.json()
  } catch {
    return fail('VALIDATION_FAILED', 'Invalid JSON body')
  }

  const raw = typeof body.isbn === 'string' ? body.isbn : ''
  const isbn = normalizeIsbn(raw)
  if (!isbn) {
    return fail('VALIDATION_FAILED', 'Enter a valid 10- or 13-digit ISBN')
  }

  const google = googleBooksResult(await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`,
  ))
  if (google) {
    return json({ success: true, data: { ...google, isbn13: google.isbn13 ?? (isbn.length === 13 ? isbn : null), isbn10: google.isbn10 ?? (isbn.length === 10 ? isbn : null) } })
  }

  const openLibrary = openLibraryResult(await fetchJson(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,
  ))
  if (openLibrary) {
    return json({ success: true, data: { ...openLibrary, isbn13: openLibrary.isbn13 ?? (isbn.length === 13 ? isbn : null), isbn10: openLibrary.isbn10 ?? (isbn.length === 10 ? isbn : null) } })
  }

  return fail('NOT_FOUND', 'No metadata found for ISBN. Please enter book details manually.')
})
