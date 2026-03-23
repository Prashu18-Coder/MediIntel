import { useState, useRef } from 'react'
import { reportAPI } from '../services/api'
import { Card, Button, Badge } from '../components/UI'
import { useToast } from '../context/ToastContext'
import './Reports.css'

const STATUS_BADGE = { normal: 'green', high: 'red', low: 'cyan', warning: 'amber', abnormal: 'red', elevated: 'amber' }

const REPORT_TYPES = [
  { id: 'blood',        icon: '🩸', label: 'Blood Test',        desc: 'CBC, lipid, glucose, thyroid'   },
  { id: 'urine',        icon: '🧪', label: 'Urine Analysis',    desc: 'Routine, culture, microscopy'   },
  { id: 'xray',         icon: '🫁', label: 'X-Ray / Scan',      desc: 'Chest, bone, abdominal'         },
  { id: 'mri',          icon: '🧠', label: 'MRI / CT Scan',     desc: 'Brain, spine, organ imaging'    },
  { id: 'ecg',          icon: '❤️', label: 'ECG / Echo',        desc: 'Heart rhythm, cardiac function' },
  { id: 'prescription', icon: '💊', label: 'Prescription',      desc: 'Medicine details, dosage'       },
  { id: 'discharge',    icon: '🏥', label: 'Discharge Summary', desc: 'Hospital discharge notes'       },
  { id: 'pathology',    icon: '🔬', label: 'Pathology',         desc: 'Biopsy, histology, culture'     },
  { id: 'other',        icon: '📋', label: 'Other Report',      desc: 'Any medical document'           },
]

// Map backend reportType string → REPORT_TYPES id
function matchReportType(backendType) {
  if (!backendType) return 'other'
  const t = backendType.toLowerCase()
  if (t.includes('blood') || t.includes('cbc') || t.includes('haemato') || t.includes('hematol')) return 'blood'
  if (t.includes('urine') || t.includes('urin')) return 'urine'
  if (t.includes('x-ray') || t.includes('xray') || t.includes('x ray') || t.includes('chest') || t.includes('bone scan')) return 'xray'
  if (t.includes('mri') || t.includes('ct scan') || t.includes('ct ') || t.includes('computed')) return 'mri'
  if (t.includes('ecg') || t.includes('echo') || t.includes('cardiac') || t.includes('electrocard')) return 'ecg'
  if (t.includes('prescription') || t.includes('rx ') || t.includes('medicine')) return 'prescription'
  if (t.includes('discharge') || t.includes('summary') || t.includes('hospital')) return 'discharge'
  if (t.includes('pathol') || t.includes('biopsy') || t.includes('histol')) return 'pathology'
  return 'other'
}

// Guess type from filename before upload
function guessTypeFromFilename(name) {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('blood') || n.includes('cbc') || n.includes('glucose') || n.includes('lipid') || n.includes('thyroid')) return 'blood'
  if (n.includes('urine') || n.includes('urin')) return 'urine'
  if (n.includes('xray') || n.includes('x-ray') || n.includes('chest') || n.includes('scan')) return 'xray'
  if (n.includes('mri') || n.includes('ct_') || n.includes('_ct') || n.includes('brain')) return 'mri'
  if (n.includes('ecg') || n.includes('echo') || n.includes('cardiac')) return 'ecg'
  if (n.includes('prescription') || n.includes('rx_') || n.includes('medicine')) return 'prescription'
  if (n.includes('discharge') || n.includes('summary')) return 'discharge'
  return null
}

const SEVERITY_COLOR = {
  normal:   { bg: 'rgba(0,229,176,0.08)',  border: 'rgba(0,229,176,0.3)',  text: '#00e5b0' },
  mild:     { bg: 'rgba(255,176,32,0.08)', border: 'rgba(255,176,32,0.3)', text: '#ffb020' },
  moderate: { bg: 'rgba(255,120,50,0.08)', border: 'rgba(255,120,50,0.3)', text: '#ff7832' },
  severe:   { bg: 'rgba(255,71,87,0.08)',  border: 'rgba(255,71,87,0.3)',  text: '#ff4757' },
}

export default function Reports() {
  const toast    = useToast()
  const fileRef  = useRef(null)
  const [file, setFile]         = useState(null)
  const [reportType, setType]   = useState(null)      // null = not detected yet
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [drag, setDrag]         = useState(false)
  const [activeTab, setTab]     = useState('summary')

  function handleFile(f) {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pdf','jpg','jpeg','png','gif','webp','csv'].includes(ext)) {
      toast.error('Please upload a PDF, image, or CSV file.')
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
    // Auto-guess from filename
    const guessed = guessTypeFromFilename(f.name)
    setType(guessed)
  }

  async function analyze() {
    if (!file) { toast.warning('Please upload a report file first.'); return }
    setLoading(true)
    setError(null)
    setTab('summary')
    try {
      const form = new FormData()
      form.append('report', file)
      if (reportType) form.append('report_type_hint', reportType)
      const res = await reportAPI.upload(form)
      setResult(res)
      // Lock type from backend result
      if (res.reportType) {
        setType(matchReportType(res.reportType))
      }
      if (res.extraction_failed && !res.not_a_report) {
        toast.warning('Could not extract values. Try uploading a clearer image or CSV.')
      } else if (!res.extraction_failed) {
        toast.success('Report analysed successfully!')
      }
    } catch (err) {
      const msg = (err && err.message) || 'Analysis failed. Check backend is running.'
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

  const sevStyle = result && result.severity && SEVERITY_COLOR[result.severity]
    ? SEVERITY_COLOR[result.severity]
    : SEVERITY_COLOR.normal

  const tabs = [
    { id: 'summary',    label: 'Summary'       },
    { id: 'values',     label: 'Test Values',  show: result && result.values && result.values.length > 0 },
    { id: 'conditions', label: 'Conditions',   show: result && result.possible_conditions && result.possible_conditions.length > 0 },
    { id: 'advice',     label: 'Advice'        },
  ].filter(t => t.show !== false)

  return (
    <div className="page-content">
      <div className="page-header">
        <span className="label">AI Medical Report Analysis</span>
        <h1>Report Analyzer</h1>
        <p>Upload any medical report — blood test, X-ray, MRI, ECG, prescription or discharge summary. Images are read by <strong>Llama 4 Scout Vision</strong>. CSV and PDF use Groq AI.</p>
      </div>

      <div className="rep-layout">

        {/* ── Left Panel ── */}
        <div className="rep-left">

          {/* Detected report type — read only, set automatically */}
          <Card style={{ marginBottom: 16 }}>
            <span className="label" style={{ marginBottom: 12, display: 'block' }}>Detected Report Type</span>
            {reportType ? (
              <div className="rep-detected-type">
                <span className="rep-detected-icon">
                  {REPORT_TYPES.find(t => t.id === reportType)?.icon || '📋'}
                </span>
                <div>
                  <div className="rep-detected-label">
                    {REPORT_TYPES.find(t => t.id === reportType)?.label || 'Medical Report'}
                  </div>
                  <div className="rep-detected-sub">
                    {result ? 'Confirmed by AI analysis' : 'Detected from filename — will be confirmed after analysis'}
                  </div>
                </div>
                <span className="rep-detected-badge">
                  {result ? '✓ Confirmed' : '⏳ Pending'}
                </span>
              </div>
            ) : (
              <div className="rep-detected-empty">
                <span style={{ fontSize: '1.4rem', opacity: 0.4 }}>📂</span>
                <span>Upload a file — type will be detected automatically</span>
              </div>
            )}
          </Card>

          {/* Upload zone */}
          <Card>
            <span className="label" style={{ marginBottom: 12, display: 'block' }}>Upload File</span>
            <div
              className={'rep-drop' + (drag ? ' drag' : '') + (file ? ' has-file' : '')}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current && fileRef.current.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.csv"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files && e.target.files[0])} />
              {file ? (
                <>
                  <div className="rep-drop-icon">📄</div>
                  <div className="rep-drop-name">{file.name}</div>
                  <div className="rep-drop-size">{(file.size / 1024).toFixed(1)} KB</div>
                  <span className="rep-drop-change">Click to change</span>
                </>
              ) : (
                <>
                  <div className="rep-drop-icon">⬆️</div>
                  <div className="rep-drop-title">Drop report here</div>
                  <div className="rep-drop-hint">PDF · JPG · PNG · CSV</div>
                </>
              )}
            </div>

            {file && (
              <Button variant="primary" className="btn-full" style={{ marginTop: 14 }}
                loading={loading} onClick={analyze}>
                Analyze Report
              </Button>
            )}

            <div className="rep-formats">
              <div className="rep-formats-title">Accepted formats</div>
              <div className="rep-format-tags">
                {['PDF', 'JPG', 'PNG', 'CSV'].map(f => (
                  <span key={f} className="rep-format-tag">{f}</span>
                ))}
              </div>
              <div className="rep-formats-note">
                For best results with blood tests, upload a CSV with columns: <strong>parameter</strong>, <strong>value</strong>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right Panel ── */}
        <div className="rep-right">

          {/* Empty state */}
          {!result && !loading && !error && (
            <div className="rep-empty">
              <div className="rep-empty-icon">🩺</div>
              <h3>Ready to Analyse</h3>
              <p>Upload your medical file — the report type is detected automatically from the file. Images are analysed by Llama 4 Scout Vision.</p>
              <div className="rep-empty-chips">
                {['Blood Test', 'X-Ray', 'MRI / CT', 'ECG', 'Prescription', 'Discharge Summary'].map(c => (
                  <span key={c} className="rep-empty-chip">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="rep-loading">
              <div className="rep-loading-ring" />
              <div className="rep-loading-text">
                {['jpg','jpeg','png','webp','gif'].some(e => file?.name?.toLowerCase().endsWith(e))
                  ? 'Analysing with Llama 4 Vision'
                  : 'Analyzing with Groq AI'}
              </div>
              <div className="rep-loading-sub">
                Reading your {reportType ? REPORT_TYPES.find(t => t.id === reportType)?.label : 'medical document'}...
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <Card style={{ borderColor: 'rgba(255,71,87,0.3)', background: 'rgba(255,71,87,0.04)' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div>
                  <h3 style={{ color: 'var(--red)', marginBottom: 8 }}>Analysis Failed</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{error}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Not a report */}
          {result && result.not_a_report && (
            <Card style={{ borderColor: 'rgba(255,71,87,0.3)', background: 'rgba(255,71,87,0.04)' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ fontSize: 32 }}>🚫</span>
                <div>
                  <h3 style={{ color: 'var(--red)', marginBottom: 8 }}>Not a Medical Report</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    The uploaded image does not appear to be a medical report. Please upload an actual lab report, prescription, or scan.
                  </p>
                  <ul style={{ fontSize: '0.82rem', color: 'var(--text-muted)', paddingLeft: 18, lineHeight: 2.2 }}>
                    <li>Photo of a printed lab report</li>
                    <li>PDF from hospital or clinic</li>
                    <li>CSV file with test values</li>
                    <li>Scanned prescription or discharge summary</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Could not extract */}
          {result && result.extraction_failed && !result.not_a_report && (
            <Card style={{ borderColor: 'rgba(255,176,32,0.3)', background: 'rgba(255,176,32,0.04)' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ fontSize: 28 }}>💡</span>
                <div>
                  <h3 style={{ color: 'var(--amber)', marginBottom: 8 }}>Could Not Extract Values</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 10 }}>{result.summary}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    For blood tests, create a CSV file with two columns: <strong style={{ color: 'var(--cyan)' }}>parameter</strong> and <strong style={{ color: 'var(--cyan)' }}>value</strong>
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Full results */}
          {result && !loading && !result.extraction_failed && (
            <>
              {/* Report header card */}
              <div className="rep-result-header" style={{ background: sevStyle.bg, border: '1px solid ' + sevStyle.border }}>
                <div className="rep-result-header-left">
                  <div className="rep-result-type-icon">
                    {REPORT_TYPES.find(t => t.id === reportType)?.icon || '📋'}
                  </div>
                  <div>
                    <div className="rep-result-type">{result.reportType || result.report_type || 'Medical Report'}</div>
                    <div className="rep-result-date">Analysed {result.date || 'today'}</div>
                  </div>
                </div>
                <div className="rep-result-header-right">
                  {result.severity && result.severity !== 'unknown' && (
                    <div className="rep-severity-badge" style={{ color: sevStyle.text, borderColor: sevStyle.border }}>
                      <span className="rep-severity-dot" style={{ background: sevStyle.text }} />
                      {result.severity.charAt(0).toUpperCase() + result.severity.slice(1)}
                    </div>
                  )}
                  {result.llama_vision && (
                    <span className="rep-ai-badge" style={{ background: 'rgba(124,92,252,0.15)', borderColor: 'rgba(124,92,252,0.4)', color: '#9d81f5' }}>🦙 Llama Vision</span>
                  )}
                  {result.groq_powered && !result.llama_vision && (
                    <span className="rep-ai-badge">Groq AI</span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="rep-tabs">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    className={'rep-tab' + (activeTab === t.id ? ' active' : '')}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab: Summary */}
              {activeTab === 'summary' && (
                <div className="rep-tab-content">
                  <Card>
                    <p className="rep-summary-text">{result.summary}</p>
                    {result.clinical_interpretation && (
                      <div className="rep-interpretation">
                        <div className="rep-interp-label">Clinical Interpretation</div>
                        <p className="rep-interp-text">{result.clinical_interpretation}</p>
                      </div>
                    )}
                  </Card>

                  {/* Stats row */}
                  {result.values && result.values.length > 0 && (
                    <div className="rep-stats-row">
                      <div className="rep-stat">
                        <div className="rep-stat-num">{result.parameters_analyzed || result.values.length}</div>
                        <div className="rep-stat-label">Tests Done</div>
                      </div>
                      <div className="rep-stat rep-stat-warn">
                        <div className="rep-stat-num" style={{ color: result.abnormal_count > 0 ? 'var(--amber)' : 'var(--green)' }}>
                          {result.abnormal_count || 0}
                        </div>
                        <div className="rep-stat-label">Abnormal</div>
                      </div>
                      <div className="rep-stat">
                        <div className="rep-stat-num" style={{ color: 'var(--green)' }}>
                          {(result.parameters_analyzed || result.values.length) - (result.abnormal_count || 0)}
                        </div>
                        <div className="rep-stat-label">Normal</div>
                      </div>
                      <div className="rep-stat">
                        <div className="rep-stat-num" style={{ color: 'var(--purple)', fontSize: '0.9rem' }}>
                          {result.urgency ? result.urgency.replace(/_/g, ' ') : 'routine'}
                        </div>
                        <div className="rep-stat-label">Urgency</div>
                      </div>
                    </div>
                  )}

                  {/* Specialist card */}
                  {result.specialist_needed && (
                    <Card style={{ borderColor: 'rgba(124,92,252,0.25)', background: 'rgba(124,92,252,0.04)' }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <span style={{ fontSize: 28 }}>👨‍⚕️</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            See a {result.specialist_needed}
                          </div>
                          {result.urgency_reason && (
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                              {result.urgency_reason}
                            </p>
                          )}
                        </div>
                        {result.urgency && result.urgency !== 'routine' && (
                          <Badge variant={result.urgency === 'immediate' ? 'red' : result.urgency === 'within_48h' ? 'red' : 'amber'}>
                            {result.urgency.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: Test Values */}
              {activeTab === 'values' && result.values && (
                <div className="rep-tab-content">
                  <Card>
                    <div className="values-table">
                      <div className="values-header">
                        <span>Parameter</span>
                        <span>Value</span>
                        <span>Normal Range</span>
                        <span>Status</span>
                      </div>
                      {result.values.map((v, i) => (
                        <div key={i} className={'values-row' + (v.status !== 'normal' ? ' abnormal-row' : '')}>
                          <span className="param-name">{v.name}</span>
                          <span className="param-val">
                            {v.value}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 4 }}>{v.unit}</span>
                          </span>
                          <span className="param-range">{v.normal}</span>
                          <Badge variant={STATUS_BADGE[v.status] || 'cyan'}>{v.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {result.what_each_means && result.what_each_means.length > 0 && (
                    <Card style={{ marginTop: 16 }}>
                      <span className="label">What Each Value Means</span>
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {result.what_each_means.map((w, i) => (
                          <div key={i} className="rep-meaning-row">
                            <span className="rep-meaning-param">{w.parameter}</span>
                            <span className="rep-meaning-text">{w.explanation}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: Conditions */}
              {activeTab === 'conditions' && (
                <div className="rep-tab-content">
                  {result.possible_conditions && result.possible_conditions.length > 0 && (
                    <Card>
                      <span className="label">Possible Conditions</span>
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.possible_conditions.map((c, i) => (
                          <div key={i} className="rep-condition">
                            <div className="rep-condition-top">
                              <span className="rep-condition-name">{c.condition}</span>
                              <Badge variant={c.likelihood === 'High' ? 'red' : c.likelihood === 'Moderate' ? 'amber' : 'cyan'}>
                                {c.likelihood}
                              </Badge>
                            </div>
                            <p className="rep-condition-note">{c.note}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: Advice */}
              {activeTab === 'advice' && (
                <div className="rep-tab-content">
                  {result.recommendations && result.recommendations.length > 0 && (
                    <Card>
                      <span className="label">Recommendations</span>
                      <ul className="reco-list" style={{ marginTop: 12 }}>
                        {result.recommendations.map((r, i) => (
                          <li key={i} className="reco-item">
                            <span className="reco-dot" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {result.diet && result.diet.length > 0 && (
                    <Card style={{ marginTop: 14 }}>
                      <span className="label">Diet Recommendations</span>
                      <ul className="reco-list" style={{ marginTop: 12 }}>
                        {result.diet.map((d, i) => (
                          <li key={i} className="reco-item">
                            <span className="reco-dot" style={{ background: 'var(--green)' }} />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {result.lifestyle && result.lifestyle.length > 0 && (
                    <Card style={{ marginTop: 14 }}>
                      <span className="label">Lifestyle Changes</span>
                      <ul className="reco-list" style={{ marginTop: 12 }}>
                        {result.lifestyle.map((l, i) => (
                          <li key={i} className="reco-item">
                            <span className="reco-dot" style={{ background: 'var(--purple)' }} />
                            {l}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {result.tests_to_do_next && result.tests_to_do_next.length > 0 && (
                    <Card style={{ marginTop: 14 }}>
                      <span className="label">Follow-up Tests</span>
                      <ul className="reco-list" style={{ marginTop: 12 }}>
                        {result.tests_to_do_next.map((t, i) => (
                          <li key={i} className="reco-item">
                            <span className="reco-dot" style={{ background: 'var(--amber)' }} />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              )}

              <p className="rep-disclaimer">
                {result.disclaimer || 'AI analysis only. Always verify with a licensed physician.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}