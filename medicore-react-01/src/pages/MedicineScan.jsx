import { useState, useRef } from 'react'
import { scanAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import './MedicineScan.css'

export default function MedicineScan() {
  const toast   = useToast()
  const fileRef = useRef(null)
  const [file, setFile]       = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const [drag, setDrag]       = useState(false)

  function handleFile(f) {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPG, PNG, WebP).')
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  async function scan() {
    if (!file) { toast.warning('Please upload a medicine image first.'); return }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const form = new FormData()
      form.append('image', file)
      console.log('[Scan] Sending:', file.name, file.type, file.size, 'bytes')
      const res = await scanAPI.verify(form)
      console.log('[Scan] Response:', res)
      setResult(res)
    } catch (err) {
      console.error('[Scan] Error:', err)
      const msg = (err && err.message) || (err && err.data && err.data.message) || 'Scan failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDrag(false)
    handleFile(e.dataTransfer.files && e.dataTransfer.files[0])
  }

  const warningText = (result && result.warning)
    || (result && Array.isArray(result.warnings) && result.warnings.length > 0 ? result.warnings[0] : null)

  const groqAnalysis = result && result.groq_analysis ? result.groq_analysis : null
  const indicators   = result && Array.isArray(result.indicators) ? result.indicators : []
  const isGenuine    = result && result.authentic
  const confidence   = result ? result.confidence : 0

  const dropClass = 'drop-zone' + (drag ? ' drag-over' : '') + (file ? ' has-file' : '')

  return (
    <div className="page-content">

      <div className="page-header">
        <div className="scan-header-accent">AI-Powered Counterfeit Detection</div>
        <h1>Medicine Scan</h1>
        <p>Upload a photo of medicine packaging — Groq Llama AI analyses authenticity in seconds.</p>
      </div>

      <div className="scan-layout">

        {/* ── Left: Upload Panel ── */}
        <div className="upload-card">
          <div
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                     textTransform: 'uppercase', letterSpacing: '0.12em',
                     color: 'var(--text-muted)', marginBottom: 12 }}>
            Upload Packaging Photo
          </div>

          <div
            className={dropClass}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current && fileRef.current.click()}
          >
            <div className="drop-corner-tr" />
            <div className="drop-corner-bl" />
            <input
              ref={fileRef} type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files && e.target.files[0])}
            />

            {preview ? (
              <div className="scan-preview">
                <div className="preview-img-wrap">
                  <img src={preview} alt="Preview" className="preview-img" />
                  <div className="preview-overlay" />
                </div>
                <div className="preview-change">click to replace image</div>
              </div>
            ) : (
              <div className="drop-zone-inner">
                <div className="drop-icon-wrap">📷</div>
                <div className="drop-title">Drop image here</div>
                <div className="drop-sub">
                  JPG, PNG or WebP — medicine box, label or blister pack
                </div>
                <div style={{
                  marginTop: 12, padding: '6px 16px',
                  border: '1px solid rgba(0,212,255,0.3)',
                  borderRadius: 6, fontSize: '0.8rem',
                  color: 'var(--cyan)', fontFamily: 'var(--font-mono)'
                }}>
                  browse files
                </div>
              </div>
            )}
          </div>

          <button
            className="btn-scan"
            onClick={scan}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid rgba(0,212,255,0.3)',
                  borderTopColor: 'var(--cyan)',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block', flexShrink: 0
                }} />
                Scanning...
              </>
            ) : (
              <>
                <span className="btn-scan-icon">🔬</span>
                Scan Medicine
              </>
            )}
          </button>

          <div className="scan-badges">
            <span className="scan-badge cyan">Groq Llama AI</span>
            {result && result.groq_powered && <span className="scan-badge green">AI Verified</span>}
            {result && result.ocr_used     && <span className="scan-badge cyan">OCR Active</span>}
            {result && !result.ocr_used    && <span className="scan-badge amber">OCR Offline</span>}
          </div>

          <div className="scan-tips">
            <div className="tips-title">Tips for best results</div>
            {[
              'Good lighting — no shadows on the label',
              'Sharp focus — hold phone steady',
              'Full label visible in frame',
              'Capture batch no. and expiry date',
              'Include any holograms or QR codes',
            ].map((tip, i) => (
              <div key={i} className="tip-row">
                <span className="tip-dot" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Result Panel ── */}
        <div>

          {/* Empty state */}
          {!result && !loading && !error && (
            <div className="scan-empty">
              <div className="scan-empty-grid" />
              <div className="scan-empty-icon">🔍</div>
              <h3>Ready to Scan</h3>
              <p>Upload a photo of medicine packaging to verify authenticity using Groq AI</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="scan-loading">
              <div className="scan-beam" />
              <div className="scan-loading-ring" />
              <div className="scan-loading-text">Analysing with Groq Llama AI</div>
              <div className="scan-loading-sub">Extracting text and verifying authenticity...</div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="scan-error">
              <div className="scan-error-header">
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div className="scan-error-title">Scan Failed</div>
              </div>
              <div className="scan-error-msg">{error}</div>
              <div className="scan-error-checklist">
                <div className="scan-error-checklist-title">Diagnostic checklist</div>
                {[
                  'Visit http://localhost:5000/api in your browser — do you see JSON?',
                  'Check backend terminal for any crash errors',
                  'Is GROQ_API_KEY set in medicore-backend/.env?',
                  'Open DevTools (F12) → Console for the exact error',
                ].map((item, i) => (
                  <div key={i} className="scan-error-item">
                    <span className="scan-error-num">{i + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="verdict-wrap">

              {/* Verdict bar */}
              <div className={'verdict-bar ' + (isGenuine ? 'genuine' : 'fake')}>
                <div className="verdict-shield">
                  {isGenuine ? '✓' : '✕'}
                </div>
                <div className="verdict-info">
                  <div className="verdict-label">
                    {isGenuine ? 'Genuine Medicine' : 'Counterfeit Detected'}
                  </div>
                  <div className="verdict-sub">
                    {result.medicine_name && result.medicine_name !== 'Not identified'
                      && result.medicine_name !== 'Could not identify — image unreadable'
                      ? result.medicine_name
                      : 'medicine unidentified'}
                  </div>
                  <div className="confidence-row">
                    <span className="confidence-label">Confidence</span>
                    <div className="confidence-bar-wrap">
                      <div
                        className="confidence-bar-fill"
                        style={{ width: confidence + '%' }}
                      />
                    </div>
                    <span className="confidence-pct">{confidence}%</span>
                  </div>
                </div>
              </div>

              <div className="result-sections">

                {/* Warning */}
                {warningText && (
                  <div className="scan-warning">
                    <span className="scan-warning-icon">🚨</span>
                    <div className="scan-warning-text">{warningText}</div>
                  </div>
                )}

                {/* Groq AI analysis */}
                {groqAnalysis && (
                  <div className="groq-box">
                    <div className="groq-box-header">
                      <span style={{ fontSize: 14 }}>🤖</span>
                      <span className="groq-box-tag">Groq AI Analysis</span>
                    </div>
                    <div className="groq-box-text">{groqAnalysis}</div>
                  </div>
                )}

                {/* Medicine details */}
                {(() => {
                  const fields = [
                    { label: 'Medicine',     value: result.medicine_name  },
                    { label: 'Manufacturer', value: result.manufacturer   },
                    { label: 'Batch No.',    value: result.batch_no       },
                    { label: 'Expiry',       value: result.expiry         },
                    { label: 'Mfg. Date',    value: result.mfg_date       },
                    { label: 'MRP',          value: result.mrp            },
                    { label: 'Dosage',       value: result.strength || result.dosage },
                    { label: 'Pack Size',    value: result.pack_size      },
                  ].filter(d => d.value
                      && d.value !== 'Not identified'
                      && d.value !== 'Not found'
                      && d.value !== 'Not readable')
                  if (!fields.length) return null
                  return (
                    <div>
                      <div className="details-section-title">Medicine Details</div>
                      <div className="details-grid">
                        {fields.map(d => (
                          <div key={d.label} className="detail-item">
                            <span className="detail-label">{d.label}</span>
                            <span className="detail-value">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Recommendation */}
                {result.recommendation && (
                  <div className="groq-box">
                    <div className="groq-box-header">
                      <span style={{ fontSize: 14 }}>💊</span>
                      <span className="groq-box-tag">Recommendation</span>
                    </div>
                    <div className="groq-box-text">{result.recommendation}</div>
                  </div>
                )}

                {/* Verification checks */}
                {indicators.length > 0 && (
                  <div>
                    <div className="details-section-title">
                      Verification Checks
                      {result.fields_found !== undefined && (
                        <span style={{ color: 'var(--cyan)', marginLeft: 8 }}>
                          {result.fields_found}/{result.fields_total} fields found
                        </span>
                      )}
                    </div>
                    <div className="checks-grid">
                      {indicators.map((ind, i) => (
                        <div key={i} className={'check-row ' + (ind.pass ? 'pass' : 'fail')}>
                          <span className="check-dot" />
                          <span>{ind.label}</span>
                          <span className="check-status">{ind.pass ? 'Pass' : 'Fail'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OCR not available */}
                {!result.ocr_used && (
                  <div className="ocr-notice">
                    <span className="ocr-notice-icon">💡</span>
                    <div>
                      <div className="ocr-notice-title">Tesseract OCR not installed</div>
                      <div className="ocr-notice-body">
                        pip install pytesseract pillow opencv-python{'\n'}
                        then install Tesseract from github.com/UB-Mannheim/tesseract/wiki
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {result.disclaimer && (
                <div className="scan-disclaimer">{result.disclaimer}</div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}