import { useMemo, useState } from 'react'

/**
 * Figma Screen 4: A-15 Books: Write-offs — "Stage Copy for Write-off" Modal.
 * Features:
 * - Barcode Scan & Quick Search input
 * - Eligibility Check (Eligible for Write-off vs Conflict / Blocked when Borrowed or Held)
 * - Target Copy State Post-Write-off (Retired | Lost)
 * - Physical Copy Assessment Notes & Mandatory Evidence Attachment
 */
export function StageWriteoffModal({ copies, alreadyStagedIds = [], onClose, onStageCopy }) {
  const [search, setSearch] = useState('')
  const [selectedCopyId, setSelectedCopyId] = useState(null)
  const [targetState, setTargetState] = useState('retired') // 'retired' | 'lost'
  const [assessmentNotes, setAssessmentNotes] = useState(
    'Spine delamination and water moisture on pages 120–160. Evaluated by Librarian.',
  )
  const [evidenceFile, setEvidenceFile] = useState('water_damage_spine.jpg')

  const matchingCopies = useMemo(() => {
    const q = search.trim().toLowerCase()
    const nonRetired = copies.filter((c) => c.status !== 'retired' && !alreadyStagedIds.includes(c.id))
    if (!q) return nonRetired
    return nonRetired.filter(
      (c) =>
        (c.barcode || '').toLowerCase().includes(q) ||
        (c.books?.title || '').toLowerCase().includes(q) ||
        (c.shelf_location || '').toLowerCase().includes(q),
    )
  }, [copies, alreadyStagedIds, search])

  const eligibleCopies = useMemo(
    () => matchingCopies.filter((c) => !['borrowed', 'held'].includes(c.status)),
    [matchingCopies],
  )
  const conflictCopies = useMemo(
    () => matchingCopies.filter((c) => ['borrowed', 'held'].includes(c.status)),
    [matchingCopies],
  )

  const selectedCopy =
    eligibleCopies.find((c) => c.id === selectedCopyId) || eligibleCopies[0] || null

  const conflictSample = conflictCopies[0] || null

  const handleStage = () => {
    if (!selectedCopy) return
    onStageCopy({
      copy: selectedCopy,
      targetState,
      assessmentNotes: assessmentNotes.trim() || 'Marked for write-off during archival inspection.',
      evidenceFile: evidenceFile.trim() || 'evidence_photo.jpg',
    })
  }

  return (
    <div className="ab-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Stage Copy for Write-off">
      <div className="ab-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #ede6db',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '19px', fontWeight: 800, color: '#241e19' }}>
            <span style={{ color: '#6e472a' }}>▣</span>
            Stage Copy for Write-off
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{ background: 'none', border: 'none', fontSize: '24px', color: '#7c736a', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 20px' }}>
          {/* 1. Barcode Scan & Quick Search */}
          <div className="ab-inspector-label">● Barcode Scan &amp; Quick Search</div>
          <div className="ab-lookup-input-wrap" style={{ marginBottom: '16px' }}>
            <span style={{ color: '#8c8277' }}>🔍</span>
            <input
              type="text"
              placeholder="Scan barcode or search title (e.g. BK-10019, Clean Code)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="ab-kbd">Enter</span>
          </div>

          {/* 2. Eligibility Check (Green Eligible Card + Red Conflict Card matching Figma) */}
          <div className="ab-inspector-label">● Eligibility Check</div>
          <div className="ab-elig-grid">
            {/* Eligible Card */}
            <div className="ab-elig-card eligible">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="ab-pill ab-pill-available">✓ Eligible for Write-off</span>
                {selectedCopy && (
                  <span className={`ab-pill ab-pill-${selectedCopy.status}`}>{selectedCopy.status}</span>
                )}
              </div>

              {selectedCopy ? (
                <>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                    <div className="ab-thumb">BK</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#241e19' }}>
                        {selectedCopy.books?.title || 'Untitled Book'}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6e665e', fontFamily: 'monospace' }}>
                        {selectedCopy.barcode} • {selectedCopy.shelf_location || 'Main Shelf'}
                      </div>
                    </div>
                  </div>
                  {eligibleCopies.length > 1 && (
                    <select
                      value={selectedCopy.id}
                      onChange={(e) => setSelectedCopyId(e.target.value)}
                      className="ab-filter-select"
                      style={{ width: '100%', marginBottom: '8px', height: '32px' }}
                    >
                      {eligibleCopies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.barcode} — {c.books?.title} ({c.status})
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className="ab-btn-brown"
                    style={{ width: '100%', height: '32px', fontSize: '14px' }}
                    onClick={() => setSelectedCopyId(selectedCopy.id)}
                  >
                    ✓ Selected for Staging
                  </button>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '14px', color: '#6e665e' }}>
                  No eligible (available/damaged) copy matches this search.
                </p>
              )}
            </div>

            {/* Conflict / Blocked Card */}
            <div className="ab-elig-card conflict">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="ab-pill ab-pill-damaged">✕ Conflict</span>
                {conflictSample && (
                  <span className={`ab-pill ab-pill-${conflictSample.status}`}>{conflictSample.status}</span>
                )}
              </div>

              {conflictSample ? (
                <>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                    <div className="ab-thumb" style={{ background: '#7c5347' }}>BK</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#241e19' }}>
                        {conflictSample.books?.title || 'Checked Out Copy'}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6e665e', fontFamily: 'monospace' }}>
                        {conflictSample.barcode} • Active Circulation
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      background: '#fee2e2',
                      color: '#b91c1c',
                      borderRadius: '8px',
                      padding: '7px 10px',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    BLOCKED: Copy is currently {conflictSample.status}. Return or release hold before write-off.
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '14px', color: '#7c736a' }}>
                  No conflicting active loans or holds matched your query.
                </p>
              )}
            </div>
          </div>

          {/* 3. Staging Options & Condition Assessment */}
          {selectedCopy && (
            <div
              style={{
                background: '#faf8f5',
                border: '1px solid #ede6db',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div className="ab-inspector-label">
                ● Staging Options &amp; Condition Assessment for Selected: {selectedCopy.barcode}
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700, color: '#6e665e', marginBottom: '6px' }}>
                TARGET COPY STATE POST-WRITE-OFF
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <button
                  type="button"
                  className={`ab-radio-card ${targetState === 'retired' ? 'selected' : ''}`}
                  onClick={() => setTargetState('retired')}
                >
                  <span className="ab-radio-dot" />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#241e19' }}>Retired</div>
                    <div style={{ fontSize: '13px', color: '#7c736a' }}>Permanently withdrawn from catalog</div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`ab-radio-card ${targetState === 'lost' ? 'selected' : ''}`}
                  onClick={() => setTargetState('lost')}
                >
                  <span className="ab-radio-dot" />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#241e19' }}>Lost</div>
                    <div style={{ fontSize: '13px', color: '#7c736a' }}>Unrecovered copy written off as lost</div>
                  </div>
                </button>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700, color: '#6e665e', marginBottom: '4px' }}>
                PHYSICAL COPY ASSESSMENT NOTES (SAVED TO AUDIT LOG)
              </div>
              <input
                type="text"
                value={assessmentNotes}
                onChange={(e) => setAssessmentNotes(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #dcd3c5',
                  padding: '0 10px',
                  fontSize: '15px',
                  marginBottom: '12px',
                  boxSizing: 'border-box',
                  background: '#ffffff',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#6e665e' }}>EVIDENCE ATTACHMENT</span>
                <span style={{ fontSize: '13px', color: '#8c8277' }}>Mandatory</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  background: '#ffffff',
                  border: '1px solid #e2d9cb',
                  borderRadius: '10px',
                  padding: '8px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span>📎</span>
                  <input
                    type="text"
                    value={evidenceFile}
                    onChange={(e) => setEvidenceFile(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: '15px', fontWeight: 600, flex: 1 }}
                  />
                </div>
                <label
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#1e7e34',
                    background: '#e6f4ea',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ATTACHED
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setEvidenceFile(f.name)
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #ede6db',
            background: '#faf7f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '14px', color: '#7c736a' }}>
            Staging does not immediately retire the copy. Stock is mutated only when slip is finalized.
          </span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button type="button" className="ab-btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="ab-btn-brown"
              disabled={!selectedCopy || !evidenceFile.trim()}
              onClick={handleStage}
            >
              ✓ Stage Copy to Slip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
