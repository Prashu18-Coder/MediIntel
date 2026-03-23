import { useState, useEffect, useRef, useCallback } from 'react'
import { dashboardAPI, patientCaseAPI, doctorAPI, prescriptionAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import './PatientDashboard.css'

const MOCK_SCORE = {
  score: 78, label: 'Good',
  vitals: [
    { label: 'Blood Pressure', value: '118/76', unit: 'mmHg', icon: '🩺', status: 'normal', trend: '+2%'  },
    { label: 'Blood Sugar',    value: '99',     unit: 'mg/dL', icon: '🩸', status: 'normal', trend: '-3%'  },
    { label: 'Heart Rate',     value: '72',     unit: 'bpm',   icon: '❤️',  status: 'normal', trend: '0%'   },
    { label: 'BMI',            value: '24.1',   unit: 'kg/m²', icon: '⚖️',  status: 'normal', trend: '-1%'  },
  ],
  advice: [
    { icon: '🚶', text: 'Walk 30 min daily',   priority: 'high'   },
    { icon: '💧', text: 'Drink 2.5L water',    priority: 'medium' },
    { icon: '🍬', text: 'Reduce sugar intake', priority: 'high'   },
    { icon: '😴', text: 'Sleep 7–8 hours',     priority: 'medium' },
    { icon: '🧘', text: '10-min meditation',   priority: 'low'    },
  ],
}
const MOCK_RISKS = [
  { name: 'Diabetes',      risk: 45, color: '#ffb020', icon: '🩸' },
  { name: 'Heart Disease', risk: 22, color: '#00e5b0', icon: '❤️'  },
  { name: 'Hypertension',  risk: 35, color: '#00d4ff', icon: '🩺' },
  { name: 'Thyroid',       risk: 15, color: '#7c5cfc', icon: '🦋' },
]
const MOCK_TIMELINE = [
  { month: 'Oct', score: 72, bp: 118, sugar: 98  },
  { month: 'Nov', score: 74, bp: 122, sugar: 102 },
  { month: 'Dec', score: 71, bp: 130, sugar: 110 },
  { month: 'Jan', score: 75, bp: 124, sugar: 105 },
  { month: 'Feb', score: 77, bp: 120, sugar: 101 },
  { month: 'Mar', score: 78, bp: 118, sugar: 99  },
]
const METRICS = [
  { key: 'score', label: 'Health Score',   color: '#00d4ff', unit: 'pts'   },
  { key: 'bp',    label: 'Blood Pressure', color: '#00e5b0', unit: 'mmHg'  },
  { key: 'sugar', label: 'Blood Sugar',    color: '#ffb020', unit: 'mg/dL' },
]
const ACTIVITIES = [
  { time: '09:14',     type: 'Report uploaded',     detail: 'CBC blood test — 2 abnormal', icon: '📋', dot: '#00d4ff' },
  { time: '08:30',     type: 'Medicine taken',       detail: 'Metformin 500mg',             icon: '💊', dot: '#00e5b0' },
  { time: 'Yesterday', type: 'Symptom check',        detail: 'Headache · Fatigue',          icon: '🩺', dot: '#7c5cfc' },
  { time: '2 days',    type: 'Appointment booked',   detail: 'Dr. Priya Mehta — 11:30 AM',  icon: '📅', dot: '#ffb020' },
  { time: '3 days',    type: 'Emergency contact set',detail: 'Ravi (+91-98xxx)',             icon: '🆘', dot: '#ff4757' },
]

function AnimatedNum({ target, duration = 1200, suffix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return <>{val}{suffix}</>
}

function ScoreRing({ score, size = 180 }) {
  const [animated, setAnimated] = useState(0)
  const cx = size / 2, cy = size / 2, r = size * 0.38, sw = size * 0.065
  const circumference = 2 * Math.PI * r
  useEffect(() => {
    let raf, start = null
    const run = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 1400, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setAnimated(Math.round(ease * score))
      if (p < 1) raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [score])
  const fill  = circumference - (animated / 100) * circumference
  const color = animated >= 80 ? '#00e5b0' : animated >= 60 ? '#00d4ff' : animated >= 40 ? '#ffb020' : '#ff4757'
  const label = animated >= 80 ? 'Excellent' : animated >= 60 ? 'Good' : animated >= 40 ? 'Fair' : 'Low'
  return (
    <div className="db-ring-wrap" style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
          <filter id="ringGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
        {[...Array(20)].map((_, i) => {
          const angle = (i / 20) * 2 * Math.PI
          const x1 = cx + (r - sw * 0.5) * Math.cos(angle), y1 = cy + (r - sw * 0.5) * Math.sin(angle)
          const x2 = cx + (r + sw * 0.5) * Math.cos(angle), y2 = cy + (r + sw * 0.5) * Math.sin(angle)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        })}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={fill} filter="url(#ringGlow)"
          style={{ transition: 'stroke-dashoffset 0.05s linear' }} />
      </svg>
      <div className="db-ring-inner" style={{ '--ring-color': color }}>
        <span className="db-score-num" style={{ color }}><AnimatedNum target={score} /></span>
        <span className="db-score-label">{label}</span>
        <span className="db-score-sub">/ 100</span>
      </div>
    </div>
  )
}

function TrendChart({ timeline, metric }) {
  const canvasRef = useRef(null), hoverRef = useRef(null)
  const [, forceUpdate] = useState(0)
  const cfg = METRICS.find(m => m.key === metric) || METRICS[0]
  const data = timeline.map(d => ({ label: d.month, value: d[metric] ?? d.score }))
  const draw = useCallback((hIdx = null) => {
    const c = canvasRef.current; if (!c || !data.length) return
    const ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr; c.height = rect.height * dpr; ctx.scale(dpr, dpr)
    const W = rect.width, H = rect.height, pad = { t:24, r:16, b:36, l:44 }
    const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b
    const vals = data.map(d => d.value), min = Math.min(...vals) * 0.93, max = Math.max(...vals) * 1.05
    const toX = i => pad.l + (i / (data.length - 1)) * iW
    const toY = v => pad.t + iH - ((v - min) / (max - min)) * iH
    ctx.clearRect(0, 0, W, H)
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (iH / 4) * i
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.setLineDash([4,6])
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '10px monospace'; ctx.textAlign = 'right'
      ctx.fillText(Math.round(max - ((max - min) / 4) * i), pad.l - 6, y + 4)
    }
    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }))
    const g = ctx.createLinearGradient(0, pad.t, 0, H - pad.b)
    g.addColorStop(0, cfg.color + '28'); g.addColorStop(1, cfg.color + '00')
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) { const mx = (pts[i-1].x + pts[i].x)/2; ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y) }
    ctx.lineTo(pts[pts.length-1].x, H-pad.b); ctx.lineTo(pts[0].x, H-pad.b); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = cfg.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.setLineDash([])
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) { const mx = (pts[i-1].x + pts[i].x)/2; ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y) }
    ctx.stroke()
    pts.forEach((p, i) => {
      const isH = hIdx === i
      ctx.beginPath(); ctx.arc(p.x, p.y, isH ? 6 : 3.5, 0, Math.PI * 2)
      ctx.fillStyle = isH ? cfg.color : cfg.color + 'bb'; ctx.fill()
      ctx.strokeStyle = '#060b18'; ctx.lineWidth = isH ? 2.5 : 1.5; ctx.stroke()
      if (isH) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fillStyle = cfg.color + '18'; ctx.fill()
        const tx = Math.max(42, Math.min(p.x - 30, W - 80)), ty = Math.max(8, p.y - 36)
        ctx.fillStyle = '#131e33'; ctx.strokeStyle = cfg.color + '60'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.roundRect(tx, ty, 68, 26, 5); ctx.fill(); ctx.stroke()
        ctx.fillStyle = cfg.color; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'
        ctx.fillText(`${data[i].value} ${cfg.unit}`, tx + 34, ty + 11)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px monospace'
        ctx.fillText(data[i].label, tx + 34, ty + 22)
      }
    })
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
    data.forEach((d, i) => ctx.fillText(d.label, toX(i), H - pad.b + 18))
  }, [data, cfg])
  useEffect(() => { draw(hoverRef.current) }, [draw])
  useEffect(() => {
    const obs = new ResizeObserver(() => draw(hoverRef.current))
    if (canvasRef.current) obs.observe(canvasRef.current.parentElement)
    return () => obs.disconnect()
  }, [draw])
  function onMouseMove(e) {
    const c = canvasRef.current; if (!c || !data.length) return
    const rect = c.getBoundingClientRect(), mx = e.clientX - rect.left
    const iW = rect.width - 60, idx = Math.round(((mx - 44) / iW) * (data.length - 1))
    const clamped = Math.max(0, Math.min(data.length - 1, idx))
    if (clamped !== hoverRef.current) { hoverRef.current = clamped; forceUpdate(n => n+1); draw(clamped) }
  }
  function onMouseLeave() { hoverRef.current = null; forceUpdate(n => n+1); draw(null) }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} />
    </div>
  )
}

function RiskGauge({ risk, color }) {
  const [w, setW] = useState(0)
  useEffect(() => { setTimeout(() => setW(risk), 80) }, [risk])
  return (
    <div className="db-risk-track">
      <div className="db-risk-fill" style={{ width: `${w}%`, background: color }} />
      <div className="db-risk-glow" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}

/* ─── Submit Case Panel ──────────────────────────────────────────── */
const COMMON_SYMPTOMS = [
  'Fever','Headache','Body Pain','Cough','Fatigue','Nausea','Vomiting',
  'Chest Pain','Shortness of Breath','Dizziness','Back Pain','Joint Pain',
  'Rash','Loss of Appetite','Swelling','Blurred Vision',
]

function SubmitCasePanel() {
  const [complaint, setComplaint] = useState('')
  const [symptoms, setSymptoms]   = useState([])
  const [duration, setDuration]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [myCases, setMyCases]     = useState([])
  const [casesLoading, setCasesLoading] = useState(true)

  useEffect(() => {
    patientCaseAPI.list()
      .then(r => setMyCases(r.cases || []))
      .catch(() => {})
      .finally(() => setCasesLoading(false))
  }, [result])

  function toggleSymptom(s) {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function handleSubmit() {
    if (!complaint.trim()) return setError('Please describe your main problem.')
    setError(''); setLoading(true); setResult(null)
    try {
      const res = await patientCaseAPI.submit({ chief_complaint: complaint, symptoms, duration })
      setResult(res)
      setComplaint(''); setSymptoms([]); setDuration('')
    } catch (e) {
      setError(e.message || 'Submission failed. Please try again.')
    }
    setLoading(false)
  }

  const SEVERITY_META = {
    emergency: { color: '#ff2d55', label: '🚨 EMERGENCY', bg: 'rgba(255,45,85,0.1)' },
    critical:  { color: '#ff4757', label: '⚠️ CRITICAL',  bg: 'rgba(255,71,87,0.08)' },
    high:      { color: '#ff6b35', label: '🔴 HIGH',      bg: 'rgba(255,107,53,0.08)' },
    moderate:  { color: '#ffb020', label: '🟡 MODERATE',  bg: 'rgba(255,176,32,0.08)' },
    low:       { color: '#00e5b0', label: '🟢 LOW',       bg: 'rgba(0,229,176,0.07)' },
    unknown:   { color: '#8fa3c0', label: '⚪ UNKNOWN',   bg: 'rgba(143,163,192,0.06)' },
  }

  return (
    <div className="db-submit-case-section">
      <div className="db-submit-two-col">
        {/* Form */}
        <div className="db-case-form-card">
          <div className="db-section-label" style={{ marginBottom: 14 }}>🩺 Submit a Problem to Doctors</div>
          <div className="db-case-field">
            <label className="db-case-label">Describe your main problem *</label>
            <textarea
              className="db-case-textarea"
              placeholder="e.g. I have been having severe chest pain for 2 days, radiating to my left arm…"
              value={complaint}
              onChange={e => setComplaint(e.target.value)}
              rows={3}
            />
          </div>
          <div className="db-case-field">
            <label className="db-case-label">Duration</label>
            <input
              className="db-case-input"
              placeholder="e.g. 3 days, 2 weeks, since morning"
              value={duration}
              onChange={e => setDuration(e.target.value)}
            />
          </div>
          <div className="db-case-field">
            <label className="db-case-label">Select symptoms (optional)</label>
            <div className="db-symptom-grid">
              {COMMON_SYMPTOMS.map(s => (
                <button
                  key={s}
                  className={`db-symptom-chip${symptoms.includes(s) ? ' db-symptom-chip--active' : ''}`}
                  onClick={() => toggleSymptom(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="db-case-error">{error}</div>}
          <button className="db-case-submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? '🤖 Llama is analyzing…' : '🚀 Submit & Get AI Triage'}
          </button>

          {result && (
            <div className="db-case-result" style={{
              background: (SEVERITY_META[result.analysis?.severity_label] || SEVERITY_META.unknown).bg,
              borderColor: (SEVERITY_META[result.analysis?.severity_label] || SEVERITY_META.unknown).color + '40',
            }}>
              <div className="db-result-header">
                <span className="db-result-badge" style={{ color: (SEVERITY_META[result.analysis?.severity_label] || SEVERITY_META.unknown).color }}>
                  {(SEVERITY_META[result.analysis?.severity_label] || SEVERITY_META.unknown).label}
                </span>
                <span className="db-result-score" style={{ color: (SEVERITY_META[result.analysis?.severity_label] || SEVERITY_META.unknown).color }}>
                  Score: {result.analysis?.severity_score || 0}/100
                </span>
              </div>
              {result.analysis?.clinical_summary && (
                <div className="db-result-summary">{result.analysis.clinical_summary}</div>
              )}
              <div className="db-result-routing">
                <span className="db-result-routing-label">Routed to:</span>
                <span className="db-result-specialty">{result.analysis?.recommended_specialty || 'General Physician'}</span>
              </div>
              {result.analysis?.urgency && (
                <div className="db-result-urgency">⏱ Urgency: <strong>{result.analysis.urgency.replace(/_/g,' ')}</strong></div>
              )}
            </div>
          )}
        </div>

        {/* My Cases */}
        <div className="db-my-cases-card">
          <div className="db-section-label" style={{ marginBottom: 14 }}>📋 My Submitted Cases</div>
          {casesLoading ? (
            <div className="db-cases-loading">Loading cases…</div>
          ) : myCases.length === 0 ? (
            <div className="db-cases-empty">
              <div style={{ fontSize: '1.8rem', opacity: 0.4, marginBottom: 8 }}>📭</div>
              No cases submitted yet. Use the form to submit your first problem.
            </div>
          ) : (
            <div className="db-cases-list">
              {myCases.map((c, i) => {
                const m = SEVERITY_META[c.severity_label] || SEVERITY_META.unknown
                return (
                  <div key={i} className="db-case-item" style={{ borderLeftColor: m.color }}>
                    <div className="db-case-item-top">
                      <span className="db-case-sev" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                      <span className="db-case-time">{new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="db-case-complaint">"{c.chief_complaint}"</div>
                    <div className="db-case-meta">
                      {c.recommended_specialty && <span>🏥 {c.recommended_specialty}</span>}
                      {c.urgency && <span>⏱ {c.urgency.replace(/_/g,' ')}</span>}
                      <span className={`db-case-status db-case-status--${c.status}`}>{c.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Book Appointment Panel ─────────────────────────────────── */
const SPECIALTIES = [
  'General Physician','Cardiologist','Neurologist','Diabetologist','Dermatologist',
  'Orthopedic','Gastroenterologist','Pulmonologist','Gynecologist','Psychiatrist',
  'Ophthalmologist','ENT','Urologist','Endocrinologist','Oncologist',
]

function BookAppointmentPanel() {
  const [doctorName, setDoctorName]   = useState('')
  const [specialty,  setSpecialty]    = useState('')
  const [hospital,   setHospital]     = useState('')
  const [slot,       setSlot]         = useState('')
  const [date,       setDate]         = useState('')
  const [reason,     setReason]       = useState('')
  const [booking,    setBooking]      = useState(false)
  const [booked,     setBooked]       = useState(null)
  const [myAppts,    setMyAppts]      = useState([])
  const [apptLoading,setApptLoading]  = useState(true)
  const [error,      setError]        = useState('')

  useEffect(() => {
    doctorAPI.appointments()
      .then(r => setMyAppts(r.appointments || []))
      .catch(() => {})
      .finally(() => setApptLoading(false))
  }, [booked])

  async function handleBook() {
    if (!doctorName.trim()) { setError('Please enter the doctor name.'); return }
    if (!slot.trim())       { setError('Please enter a time slot.'); return }
    setError('')
    setBooking(true)
    try {
      const res = await doctorAPI.book({
        doctor_id:   'manual',
        doctor_name: doctorName.trim(),
        specialty:   specialty,
        hospital:    hospital.trim(),
        slot:        slot.trim(),
        date:        date,
        reason:      reason.trim(),
      })
      setBooked(res)
      setDoctorName(''); setSpecialty(''); setHospital('')
      setSlot(''); setDate(''); setReason('')
    } catch (e) {
      setError(e.message || 'Booking failed. Please try again.')
    }
    setBooking(false)
  }

  const APPT_STATUS_COLOR = {
    confirmed: { color: '#00d4ff', bg: 'rgba(0,212,255,0.1)' },
    pending:   { color: '#ffb020', bg: 'rgba(255,176,32,0.1)' },
    completed: { color: '#00e5b0', bg: 'rgba(0,229,176,0.1)' },
    cancelled: { color: '#ff4757', bg: 'rgba(255,71,87,0.08)' },
  }

  return (
    <div className="db-appt-section">
      <div className="db-submit-two-col">

        {/* Manual booking form */}
        <div className="db-case-form-card">
          <div className="db-section-label" style={{ marginBottom: 14 }}>📅 Book an Appointment</div>

          <div className="db-case-field">
            <label className="db-case-label">Doctor Name *</label>
            <input className="db-case-input"
              placeholder="e.g. Dr. Ramesh Babu"
              value={doctorName}
              onChange={e => setDoctorName(e.target.value)} />
          </div>

          <div className="db-case-field">
            <label className="db-case-label">Specialty</label>
            <select className="db-case-input" value={specialty} onChange={e => setSpecialty(e.target.value)}
              style={{ cursor: 'pointer' }}>
              <option value="">— Select specialty —</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="db-case-field">
            <label className="db-case-label">Hospital / Clinic</label>
            <input className="db-case-input"
              placeholder="e.g. Apollo Hospitals, Hyderabad"
              value={hospital}
              onChange={e => setHospital(e.target.value)} />
          </div>

          <div className="db-appt-row">
            <div className="db-case-field" style={{ flex: 1 }}>
              <label className="db-case-label">Date</label>
              <input className="db-case-input" type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="db-case-field" style={{ flex: 1 }}>
              <label className="db-case-label">Time Slot *</label>
              <input className="db-case-input"
                placeholder="e.g. 10:30 AM"
                value={slot}
                onChange={e => setSlot(e.target.value)} />
            </div>
          </div>

          <div className="db-case-field">
            <label className="db-case-label">Reason for Visit</label>
            <textarea className="db-case-textarea"
              placeholder="e.g. Follow-up for diabetes, General checkup, Chest pain…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2} />
          </div>

          {error && <div className="db-case-error">{error}</div>}

          {booked && (
            <div className="db-appt-success">
              ✅ Appointment booked with <strong>{booked.doctor_name}</strong>
              {booked.slot ? ` at ${booked.slot}` : ''}
              {booked.date ? ` on ${booked.date}` : ''}
            </div>
          )}

          <button className="db-case-submit-btn"
            onClick={handleBook}
            disabled={booking || !doctorName.trim() || !slot.trim()}
            style={{ marginTop: 4 }}>
            {booking ? 'Booking…' : '📅 Confirm Appointment'}
          </button>
        </div>

        {/* My appointments */}
        <div className="db-my-cases-card">
          <div className="db-section-label" style={{ marginBottom: 14 }}>🗓 My Appointments</div>
          {apptLoading ? (
            <div className="db-cases-loading">Loading…</div>
          ) : myAppts.length === 0 ? (
            <div className="db-cases-empty">
              <div style={{ fontSize: '1.8rem', opacity: 0.4, marginBottom: 8 }}>📭</div>
              No appointments yet. Book one using the form.
            </div>
          ) : (
            <div className="db-cases-list">
              {myAppts.map((a, i) => {
                const sm = APPT_STATUS_COLOR[a.status] || APPT_STATUS_COLOR.confirmed
                return (
                  <div key={i} className="db-case-item" style={{ borderLeftColor: sm.color }}>
                    <div className="db-case-item-top">
                      <span className="db-case-sev" style={{ color: sm.color, background: sm.bg }}>
                        {(a.status || 'confirmed').toUpperCase()}
                      </span>
                      <span className="db-case-time">
                        {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="db-case-complaint" style={{ fontStyle: 'normal', fontWeight: 600 }}>
                      👨‍⚕️ {a.doctor_name}
                    </div>
                    <div className="db-case-meta">
                      {a.specialty && <span>🏥 {a.specialty}</span>}
                      {a.slot      && <span>⏰ {a.slot}</span>}
                      {a.reason    && <span>📝 {a.reason}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── My Prescriptions Panel ─────────────────────────────── */
function MyPrescriptionsPanel() {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading]             = useState(true)
  const [expanded, setExpanded]           = useState(null)

  useEffect(() => {
    prescriptionAPI.mine()
      .then(r => setPrescriptions(r.prescriptions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="db-submit-case-section">
      <div className="db-submit-two-col">
        <div className="db-case-form-card">
          <div className="db-section-label" style={{ marginBottom: 14 }}>💊 My Prescriptions</div>

          {loading ? (
            <div className="db-cases-loading">Loading…</div>
          ) : prescriptions.length === 0 ? (
            <div className="db-cases-empty">
              <div style={{ fontSize: '1.8rem', opacity: 0.4, marginBottom: 8 }}>💊</div>
              No prescriptions yet. They will appear here once your doctor writes one for you.
            </div>
          ) : (
            <div className="db-cases-list">
              {prescriptions.map((rx, i) => (
                <div key={i} className="db-case-item" style={{ borderLeftColor: 'var(--purple)' }}>
                  <div className="db-case-item-top">
                    <span className="db-case-sev" style={{ color: 'var(--purple)', background: 'rgba(124,92,252,0.1)' }}>
                      {rx.status?.toUpperCase()}
                    </span>
                    <span className="db-case-time">
                      {new Date(rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 3 }}>
                    👨‍⚕️ Dr. {rx.doctor_name} {rx.doctor_specialty ? `— ${rx.doctor_specialty}` : ''}
                  </div>
                  {rx.diagnosis && (
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 6 }}>
                      📋 {rx.diagnosis}
                    </div>
                  )}

                  {/* Medicines */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 6 }}>
                    {(expanded === i ? rx.medicines : rx.medicines?.slice(0, 2))?.map((m, j) => (
                      <div key={j} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '8px 10px', borderRadius: 7,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
                          color: 'var(--purple)', background: 'rgba(124,92,252,0.1)',
                          padding: '1px 6px', borderRadius: 4, flexShrink: 0, marginTop: 2,
                        }}>{j + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {m.name}
                            {m.dosage && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan)', background: 'rgba(0,212,255,0.08)', padding: '1px 6px', borderRadius: 4 }}>
                                {m.dosage}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            {[m.frequency, m.timing, m.duration].filter(Boolean).join(' · ')}
                            {m.instructions && <span style={{ color: 'var(--amber)' }}> — {m.instructions}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {rx.medicines?.length > 2 && (
                      <button onClick={() => setExpanded(expanded === i ? null : i)}
                        style={{ background: 'none', border: 'none', color: 'var(--purple)', fontSize: '0.7rem', cursor: 'pointer', textAlign: 'left', padding: '2px 0', fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                        {expanded === i ? '▲ Show less' : `▼ +${rx.medicines.length - 2} more medicines`}
                      </button>
                    )}
                  </div>

                  <div className="db-case-meta">
                    {rx.tests_advised?.length > 0 && <span>🔬 Tests: {rx.tests_advised.join(', ')}</span>}
                    {rx.follow_up && <span>📅 Follow-up: {rx.follow_up}</span>}
                    {rx.advice    && <span>📝 {rx.advice}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right side — info card */}
        <div className="db-my-cases-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 10, padding: 28 }}>
          <div style={{ fontSize: '2.5rem', opacity: 0.5 }}>💊</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Doctor Prescriptions
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 220 }}>
            Prescriptions written by your doctor appear here automatically. Each one includes medicines, dosage, tests, and advice.
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--purple)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} on record
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PatientDashboard() {
  const { user } = useAuth()
  const [scoreData, setScoreData] = useState(null)
  const [risks, setRisks]         = useState([])
  const [timeline, setTimeline]   = useState([])
  const [metric, setMetric]       = useState('score')
  const [loading, setLoading]     = useState(true)
  const [activeVital, setActiveVital] = useState(null)
  const [time, setTime]           = useState(new Date())

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => {
    async function load() {
      try { const s = await dashboardAPI.healthScore(); setScoreData(s) } catch { setScoreData(MOCK_SCORE) }
      try { const r = await dashboardAPI.risks(); setRisks(r.risks) } catch { setRisks(MOCK_RISKS) }
      try { const t = await dashboardAPI.timeline(); setTimeline(t.timeline) } catch { setTimeline(MOCK_TIMELINE) }
      setLoading(false)
    }
    load()
  }, [])

  const firstName = user?.full_name?.split(' ')[0] || 'User'
  const hour = time.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) return (
    <div className="db-boot">
      <div className="db-boot-ring"><div className="db-boot-pulse" /></div>
      <div className="db-boot-label">Loading health data…</div>
    </div>
  )

  const cfg = METRICS.find(m => m.key === metric)

  return (
    <div className="page-content db-root">
      <div className="db-header">
        <div className="db-header-left">
          <div className="db-greeting">{greeting}, {firstName}</div>
          <div className="db-subline">Here's your personal health overview</div>
        </div>
        <div className="db-header-right">
          <div className="db-clock">
            <span className="db-clock-time">{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span className="db-clock-date">{time.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="db-live-dot"><span className="db-live-pulse" />Live</div>
        </div>
      </div>

      <div className="db-row1">
        <div className="db-score-card">
          <div className="db-score-card-bg" />
          <div className="db-score-top">
            <span className="db-section-label">Health Score</span>
            <span className="db-score-badge">AI Computed</span>
          </div>
          <div className="db-score-center"><ScoreRing score={scoreData?.score || 0} size={170} /></div>
          <div className="db-advice-list">
            {(scoreData?.advice || []).map((a, i) => (
              <div key={i} className={`db-advice-item db-adv-${a.priority}`}>
                <span className="db-adv-icon">{a.icon}</span>
                <span className="db-adv-text">{a.text}</span>
                <span className={`db-adv-pill db-adv-pill-${a.priority}`}>{a.priority}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="db-vitals-grid">
          {(scoreData?.vitals || []).map((v, i) => (
            <div key={i} className={'db-vital-card' + (activeVital === i ? ' active' : '')}
              onClick={() => setActiveVital(activeVital === i ? null : i)}>
              <div className="db-vital-glow" />
              <div className="db-vital-top">
                <span className="db-vital-icon">{v.icon}</span>
                <span className={`db-vital-status db-vital-status-${v.status}`}>{v.status}</span>
              </div>
              <div className="db-vital-value">
                <AnimatedNum target={parseFloat(v.value) || 0} duration={900} />
                <span className="db-vital-unit">{v.unit}</span>
              </div>
              <div className="db-vital-label">{v.label}</div>
              {v.trend && (
                <div className={`db-vital-trend ${v.trend.startsWith('-') ? 'db-trend-down' : v.trend === '0%' ? 'db-trend-flat' : 'db-trend-up'}`}>
                  {v.trend.startsWith('-') ? '↓' : v.trend === '0%' ? '→' : '↑'} {v.trend}
                </div>
              )}
              <div className="db-vital-bar"><div className="db-vital-bar-fill" style={{ width: `${Math.min(100, parseFloat(v.value) / 2)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="db-row2">
        <div className="db-chart-card">
          <div className="db-chart-header">
            <div>
              <div className="db-section-label">Health Trend</div>
              <div className="db-chart-subtitle">6-month progression</div>
            </div>
            <div className="db-metric-tabs">
              {METRICS.map(m => (
                <button key={m.key} className={'db-metric-tab' + (metric === m.key ? ' active' : '')}
                  style={metric === m.key ? { '--tab-color': m.color } : {}} onClick={() => setMetric(m.key)}>
                  <span className="db-tab-dot" style={{ background: m.color }} />{m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="db-chart-area"><TrendChart timeline={timeline} metric={metric} /></div>
          <div className="db-chart-footer">
            {[
              { label: 'Current', val: timeline.length ? timeline[timeline.length-1]?.[metric] ?? '—' : '—', color: cfg?.color },
              { label: '6mo ago', val: timeline.length ? timeline[0]?.[metric] ?? '—' : '—', color: 'rgba(255,255,255,0.4)' },
              { label: 'Change', val: timeline.length > 1 ? (((timeline[timeline.length-1]?.[metric]??0)-(timeline[0]?.[metric]??0)) >= 0 ? '+' : '') + ((timeline[timeline.length-1]?.[metric]??0)-(timeline[0]?.[metric]??0)) : '—', color: '#00e5b0' },
            ].map((s,i) => (
              <div key={i} className="db-chart-stat">
                <span className="db-chart-stat-val" style={{ color: s.color }}>{s.val}</span>
                <span className="db-chart-stat-lbl">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="db-risk-card">
          <div className="db-section-label" style={{ marginBottom: 16 }}>Risk Assessment</div>
          <div className="db-risk-list">
            {risks.map((r, i) => (
              <div key={i} className="db-risk-row">
                <div className="db-risk-head">
                  <div className="db-risk-name-wrap"><span className="db-risk-ico">{r.icon}</span><span className="db-risk-name">{r.name}</span></div>
                  <span className="db-risk-pct" style={{ color: r.color }}><AnimatedNum target={r.risk} duration={800 + i * 100} suffix="%" /></span>
                </div>
                <RiskGauge risk={r.risk} color={r.color} />
                <div className="db-risk-label" style={{ color: r.color }}>{r.risk >= 60 ? 'High Risk' : r.risk >= 35 ? 'Moderate' : 'Low Risk'}</div>
              </div>
            ))}
          </div>
          <div className="db-risk-disclaimer">Based on vitals, symptoms &amp; lifestyle data</div>
        </div>
      </div>

      <div className="db-row3">
        <div className="db-activity-card">
          <div className="db-section-label" style={{ marginBottom: 16 }}>Recent Activity</div>
          <div className="db-activity-list">
            {ACTIVITIES.map((a, i) => (
              <div key={i} className="db-activity-row">
                <div className="db-activity-line">
                  <div className="db-activity-dot" style={{ background: a.dot, boxShadow: `0 0 8px ${a.dot}60` }} />
                  {i < ACTIVITIES.length - 1 && <div className="db-activity-connector" />}
                </div>
                <div className="db-activity-body">
                  <div className="db-activity-top">
                    <span className="db-activity-type">{a.icon} {a.type}</span>
                    <span className="db-activity-time">{a.time}</span>
                  </div>
                  <div className="db-activity-detail">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="db-quickstats">
          {[
            { label: 'Reports Uploaded', val: 7,  icon: '📋', color: '#00d4ff' },
            { label: 'Medicines Active', val: 3,  icon: '💊', color: '#00e5b0' },
            { label: 'Appointments',     val: 2,  icon: '📅', color: '#7c5cfc' },
            { label: 'Symptom Checks',  val: 12, icon: '🩺', color: '#ffb020' },
            { label: 'Emergency Alerts',val: 0,  icon: '🆘', color: '#ff4757' },
            { label: 'Days Streak',     val: 14, icon: '🔥', color: '#ff6b35' },
          ].map((s, i) => (
            <div key={i} className="db-qs-card" style={{ '--qs-color': s.color }}>
              <span className="db-qs-icon">{s.icon}</span>
              <div className="db-qs-num" style={{ color: s.color }}><AnimatedNum target={s.val} duration={700 + i * 80} /></div>
              <div className="db-qs-label">{s.label}</div>
              <div className="db-qs-bar"><div className="db-qs-bar-fill" style={{ background: s.color, width: `${Math.min(100, s.val * 8)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <BookAppointmentPanel />

      <MyPrescriptionsPanel />

      <SubmitCasePanel />

      <div className="db-disclaimer">⚕️ MediIntel AI — For informational purposes only. Not a substitute for professional medical advice.</div>
    </div>
  )
}