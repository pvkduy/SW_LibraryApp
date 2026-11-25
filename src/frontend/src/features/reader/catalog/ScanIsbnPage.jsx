import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { isValidIsbn, normalizeIsbn } from './cartHelpers'
import { BackArrowIcon, BarcodeIcon, ShelfBookLogo } from './CatalogIcons'
import './catalog.css'

/**
 * Figma Screen 1: Scan ISBN (R-07, FR-SRCH-07).
 * - Requests camera permission on entry and cleanly stops MediaStream tracks on close.
 * - Uses native BarcodeDetector when available; always provides manual ISBN entry fallback (NFR-08).
 * - Validates EAN-13 (978/979) checksum; opens book detail if found, or shows "Not in the catalog".
 */
export function ScanIsbnPage({ onBack, onBookFound }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraState, setCameraState] = useState('initializing') // initializing | active | unavailable
  const [detectedText, setDetectedText] = useState('')
  const [manualIsbn, setManualIsbn] = useState('')
  const [statusError, setStatusError] = useState(null)
  const [notFoundIsbn, setNotFoundIsbn] = useState(null)
  const [searching, setSearching] = useState(false)

  const lookupIsbn = async (raw) => {
    const clean = normalizeIsbn(raw)
    setStatusError(null)
    setNotFoundIsbn(null)

    if (!clean) {
      setStatusError('Please enter or scan an ISBN-13 / ISBN-10 code.')
      return
    }

    if (!isValidIsbn(clean)) {
      setStatusError(`Invalid ISBN checksum (${clean}). Expected a valid 13-digit (978/979) or 10-digit ISBN.`)
      return
    }

    setSearching(true)
    setDetectedText(`ISBN detected: ${clean}`)

    try {
      const { data, error } = await supabase
        .from('books')
        .select('id, title, isbn13, isbn10')
        .eq('status', 'active')
        .or(`isbn13.eq.${clean},isbn10.eq.${clean}`)
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        onBookFound(data[0].id)
      } else {
        setNotFoundIsbn(clean)
      }
    } catch (err) {
      setStatusError(err.message || 'Could not look up ISBN right now.')
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    let active = true
    let detectorInterval = null

    async function startCamera() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (active) setCameraState('unavailable')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setCameraState('active')

        // Use native browser BarcodeDetector when supported (Chrome/Edge/Android)
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8'] })
          detectorInterval = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0 && codes[0].rawValue) {
                const candidate = normalizeIsbn(codes[0].rawValue)
                if (isValidIsbn(candidate)) {
                  window.clearInterval(detectorInterval)
                  lookupIsbn(candidate)
                }
              }
            } catch {
              // ignore frame errors
            }
          }, 500)
        }
      } catch {
        if (active) setCameraState('unavailable')
      }
    }

    startCamera()

    return () => {
      active = false
      if (detectorInterval) window.clearInterval(detectorInterval)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    lookupIsbn(manualIsbn)
  }

  return (
    <div className="sh-scanner-shell">
      {/* Top Brown Brand Bar */}
      <header className="sh-topbar">
        <div className="sh-topbar-inner">
          <div className="sh-topbar-left" />
          <div className="sh-topbar-center" onClick={onBack}>
            <ShelfBookLogo size={24} />
            <span>ShelfHelp</span>
          </div>
          <div className="sh-topbar-right" />
        </div>
      </header>

      {/* Sub-header matching Figma: ← Scan ISBN */}
      <div className="sh-scanner-subbar">
        <button
          type="button"
          className="sh-icon-btn sh-icon-btn-ghost"
          onClick={onBack}
          aria-label="Back to catalog"
        >
          <BackArrowIcon size={20} />
        </button>
        <span>Scan ISBN</span>
      </div>

      {/* Camera Viewfinder Stage */}
      <div style={{ padding: '0 16px 32px', maxWidth: '500px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div className="sh-scanner-stage">
          {cameraState === 'active' ? (
            <video ref={videoRef} autoPlay playsInline muted className="sh-scanner-video" />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: '#cfc4b9', zIndex: 1 }}>
              <BarcodeIcon size={44} color="#a99d91" />
              <p style={{ fontSize: '13px', marginTop: '10px', maxWidth: '240px' }}>
                {cameraState === 'initializing'
                  ? 'Requesting camera permission...'
                  : 'Camera unavailable or permission denied. Use manual ISBN entry below.'}
              </p>
            </div>
          )}

          {/* Green Reticle + Red Laser Line (Figma Screen 1) */}
          <div className="sh-scanner-reticle">
            <span className="sh-reticle-corner tl" />
            <span className="sh-reticle-corner tr" />
            <span className="sh-reticle-corner bl" />
            <span className="sh-reticle-corner br" />
            <div className="sh-laser-line" />
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '18px',
              left: '16px',
              right: '16px',
              textAlign: 'center',
              zIndex: 2,
            }}
          >
            {detectedText && (
              <div
                style={{
                  display: 'inline-block',
                  background: 'rgba(46, 105, 48, 0.92)',
                  color: '#ffffff',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '8px',
                }}
              >
                {detectedText}
              </div>
            )}
            <p style={{ margin: 0, fontSize: '12.5px', color: '#f3ece4', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              Align barcode within the square to scan.
              <br />A scan will automatically happen.
            </p>
          </div>
        </div>

        {/* Manual ISBN Entry Fallback (FR-SRCH-07 & NFR-08) */}
        <form
          onSubmit={handleManualSubmit}
          style={{
            marginTop: '18px',
            background: '#2f231a',
            border: '1px solid #4a3729',
            borderRadius: '16px',
            padding: '16px',
          }}
        >
          <label
            htmlFor="manual-isbn-input"
            style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#e6dad0', marginBottom: '8px' }}
          >
            Or enter ISBN-13 / ISBN-10 manually:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="manual-isbn-input"
              type="text"
              placeholder="e.g. 978-0-465-05065-9"
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              style={{
                flex: 1,
                height: '42px',
                borderRadius: '10px',
                border: '1px solid #5c4534',
                background: '#1c140e',
                color: '#ffffff',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              className="sh-btn-primary"
              disabled={searching}
              style={{ height: '42px', padding: '0 18px' }}
            >
              {searching ? 'Checking...' : 'Lookup'}
            </button>
          </div>

          {/* Quick Demo ISBN buttons for fast testing without physical barcode */}
          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#b5a698' }}>Quick scan test:</span>
            {[
              { label: 'Design of Everyday Things', isbn: '9780465050659' },
              { label: 'Clean Code', isbn: '9780132350884' },
              { label: 'Atomic Habits', isbn: '9780735211292' },
            ].map((sample) => (
              <button
                key={sample.isbn}
                type="button"
                onClick={() => {
                  setManualIsbn(sample.isbn)
                  lookupIsbn(sample.isbn)
                }}
                style={{
                  background: '#3d2d22',
                  border: '1px solid #634937',
                  color: '#f5eae0',
                  borderRadius: '999px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>

          {statusError && (
            <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: '#fca5a5' }}>{statusError}</p>
          )}

          {notFoundIsbn && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '10px',
                background: '#3d251b',
                border: '1px solid #8a4b32',
                fontSize: '13px',
                color: '#fde8df',
              }}
            >
              <strong>Not in the catalog:</strong> No book matched ISBN <code>{notFoundIsbn}</code>.
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#e5cbbd' }}>
                You can request the library to acquire this title via Book Suggestions.
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
