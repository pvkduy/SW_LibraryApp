import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

/**
 * Evidence thumbnails live in a private bucket, so previews need a short-lived
 * signed URL. A missing/empty object degrades to a neutral placeholder instead
 * of a broken image.
 */
export function EvidenceThumb({ path, size = 56, removable = false, onRemove, alt = 'Evidence photo' }) {
  const [state, setState] = useState({ url: null, failed: false })

  useEffect(() => {
    let alive = true
    if (!path) return undefined
    supabase.storage
      .from('evidence')
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!alive) return
        setState(error || !data?.signedUrl ? { url: null, failed: true } : { url: data.signedUrl, failed: false })
      })
    return () => {
      alive = false
    }
  }, [path])

  return (
    <span className="books-evidence-thumb" style={{ width: size, height: size }} title={path}>
      {state.url && !state.failed ? (
        <img src={state.url} alt={alt} onError={() => setState({ url: null, failed: true })} />
      ) : (
        <span className="books-evidence-thumb-fallback" aria-hidden="true">
          {state.failed ? '✕' : '…'}
        </span>
      )}
      {removable && (
        <button type="button" className="books-evidence-remove" aria-label="Remove evidence photo" onClick={onRemove}>
          ✕
        </button>
      )}
    </span>
  )
}
