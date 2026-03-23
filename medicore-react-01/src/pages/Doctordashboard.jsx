import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { doctorPortalAPI, mentalAPI } from '../services/api'
import './DoctorDashboard.css'

/* ── Constants ─────────────────────────────────────────────────── */
const SPECIALIZATIONS = [
  'General Physician','Cardiologist','Neurologist','Diabetologist','Dermatologist',
  'Orthopedic','Gastroenterologist','Pulmonologist','Gynecologist','Psychiatrist',
  'Ophthalmologist','ENT','Urologist','Endocrinologist','Oncologist',
]

const SEV = {
  emergency:{ color:'#ff2d55', bg:'rgba(255,45,85,0.1)',  border:'rgba(255,45,85,0.3)',  label:'EMERGENCY', icon:'🚨' },
  critical: { color:'#ff4757', bg:'rgba(255,71,87,0.1)',  border:'rgba(255,71,87,0.25)', label:'CRITICAL',  icon:'⚠️' },
  high:     { color:'#ff6b35', bg:'rgba(255,107,53,0.1)', border:'rgba(255,107,53,0.25)',label:'HIGH',      icon:'🔴' },
  moderate: { color:'#ffb020', bg:'rgba(255,176,32,0.1)', border:'rgba(255,176,32,0.22)',label:'MODERATE',  icon:'🟡' },
  low:      { color:'#00e5b0', bg:'rgba(0,229,176,0.08)', border:'rgba(0,229,176,0.2)',  label:'LOW',       icon:'🟢' },
  unknown:  { color:'#8fa3c0', bg:'rgba(143,163,192,0.07)',border:'rgba(143,163,192,0.18)',label:'UNKNOWN', icon:'⚪' },
}
const URG = {
  immediate:   { label:'Immediate', color:'#ff2d55' },
  within_48h:  { label:'48 hours',  color:'#ff6b35' },
  within_week: { label:'This week', color:'#ffb020' },
  routine:     { label:'Routine',   color:'#00e5b0' },
}

/* ── Helpers ────────────────────────────────────────────────────── */
function AnimNum({ target, duration = 900 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let s = null
    const step = ts => {
      if (!s) s = ts
      const p = Math.min((ts - s) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return <>{val}</>
}

function SevBadge({ label }) {
  const m = SEV[label] || SEV.unknown
  return <span className="drd-sev-badge" style={{ background:m.bg, border:`1px solid ${m.border}`, color:m.color }}>{m.icon} {m.label}</span>
}

function ScoreBar({ score, label }) {
  const [w, setW] = useState(0)
  useEffect(() => { setTimeout(() => setW(score), 80) }, [score])
  const m = SEV[label] || SEV.unknown
  return (
    <div className="drd-score-bar-wrap">
      <div className="drd-score-bar"><div className="drd-score-fill" style={{ width:`${w}%`, background:m.color }} /></div>
      <span className="drd-score-num" style={{ color:m.color }}>{score}</span>
    </div>
  )
}

function Avatar({ name, bg }) {
  return (
    <div className="drd-avatar" style={{ background: bg || 'rgba(124,92,252,0.15)' }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

/* ── Bar Chart ──────────────────────────────────────────────────── */
function BarChart({ data, valueKey, labelKey, color='#7c5cfc', height=130 }) {
  const ref  = useRef(null)
  const [hov, setHov] = useState(null)
  const vals = data.map(d => d[valueKey] || 0)
  const max  = Math.max(...vals, 1) * 1.18

  const draw = useCallback((hIdx) => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr; c.height = rect.height * dpr; ctx.scale(dpr, dpr)
    const W = rect.width, H = rect.height
    const pad = { t:18, r:8, b:28, l:32 }
    const iW = W-pad.l-pad.r, iH = H-pad.t-pad.b
    const bW = iW/data.length, gap = bW*0.28
    ctx.clearRect(0,0,W,H)
    for (let i=0; i<=3; i++) {
      const y = pad.t+(iH/3)*i
      ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1; ctx.setLineDash([4,6])
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.font='9px monospace'; ctx.textAlign='right'
      ctx.fillText(Math.round(max-(max/3)*i), pad.l-4, y+3)
    }
    data.forEach((d,i) => {
      const bH = ((d[valueKey]||0)/max)*iH
      const x=pad.l+i*bW+gap/2, y=pad.t+iH-bH, w=bW-gap
      const isH = hIdx===i
      const g = ctx.createLinearGradient(0,y,0,y+bH)
      g.addColorStop(0, isH?color:color+'bb'); g.addColorStop(1, color+'28')
      ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(x,y,w,bH,[3,3,0,0]); ctx.fill()
      if (isH && bH>0) {
        ctx.fillStyle='#131e33'; ctx.strokeStyle=color+'70'; ctx.lineWidth=1
        const tx=Math.max(pad.l,Math.min(x+w/2-24,W-56)), ty=Math.max(4,y-24)
        ctx.beginPath(); ctx.roundRect(tx,ty,50,18,3); ctx.fill(); ctx.stroke()
        ctx.fillStyle=color; ctx.font='bold 9px monospace'; ctx.textAlign='center'
        ctx.fillText(d[valueKey]||0, tx+25, ty+7)
        ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='8px monospace'
        ctx.fillText((d[labelKey]||'').toString().slice(0,5), tx+25, ty+16)
      }
      ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.font='9px monospace'; ctx.textAlign='center'
      ctx.fillText((d[labelKey]||'').toString().slice(0,4), x+w/2, H-pad.b+14)
    })
  }, [data, valueKey, labelKey, color])

  useEffect(() => { draw(hov) }, [draw, hov])
  useEffect(() => {
    const obs = new ResizeObserver(() => draw(hov))
    if (ref.current) obs.observe(ref.current.parentElement)
    return () => obs.disconnect()
  }, [draw, hov])

  function onMove(e) {
    const c=ref.current; if(!c) return
    const rect=c.getBoundingClientRect()
    const iW=rect.width-40, bW=iW/data.length
    setHov(Math.max(0,Math.min(data.length-1,Math.floor((e.clientX-rect.left-32)/bW))))
  }
  return (
    <canvas ref={ref} style={{ width:'100%', height, cursor:'crosshair', display:'block' }}
      onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
  )
}

/* ── Setup Modal ────────────────────────────────────────────────── */
function SpecSetupModal({ onSave, current, saving }) {
  const [spec, setSpec] = useState(current?.specialization || '')
  const [exp,  setExp]  = useState(current?.experience || '')
  const [hosp, setHosp] = useState(current?.hospital || '')
  return (
    <div className="drd-modal-overlay">
      <div className="drd-modal">
        <div className="drd-modal-title">⚕️ Set Your Specialization</div>
        <div className="drd-modal-sub">This lets MediIntel AI route the right patients to you automatically.</div>
        <div className="drd-modal-field">
          <label>Specialization *</label>
          <select value={spec} onChange={e => setSpec(e.target.value)} className="drd-modal-select">
            <option value="">— Select —</option>
            {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="drd-modal-field">
          <label>Experience</label>
          <input className="drd-modal-input" placeholder="e.g. 8 years" value={exp} onChange={e => setExp(e.target.value)} />
        </div>
        <div className="drd-modal-field">
          <label>Hospital / Clinic</label>
          <input className="drd-modal-input" placeholder="e.g. Apollo Hospitals" value={hosp} onChange={e => setHosp(e.target.value)} />
        </div>
        <button className="drd-modal-save" disabled={!spec || saving}
          onClick={() => onSave({ specialization:spec, experience:exp, hospital:hosp })}>
          {saving ? 'Saving…' : 'Save & Start'}
        </button>
      </div>
    </div>
  )
}

/* ── Case Detail Panel ──────────────────────────────────────────── */
function CaseDetailPanel({ c, onClose, onReprioritize, reprioritizing, onReview }) {
  const pat = c.user_id || {}
  const m   = SEV[c.severity_label] || SEV.unknown
  const u   = URG[c.urgency] || URG.routine
  const a   = c.llama_analysis || {}
  const [reviewing, setReviewing] = useState(false)
  const [notes, setNotes]         = useState(c.notes || '')

  async function handleReview(status) {
    setReviewing(true)
    await onReview(c._id, notes, status)
    setReviewing(false)
  }

  return (
    <div className="drd-card drd-detail-panel" style={{ '--panel-color': m.color }}>
      <div className="drd-detail-header">
        <div>
          <div className="drd-detail-name">{pat.full_name || 'Anonymous'}</div>
          <div className="drd-detail-sub">{pat.age ? `${pat.age}y · ` : ''}{pat.gender} · {pat.email}</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button className="drd-btn-icon" onClick={() => onReprioritize(c._id)} disabled={reprioritizing} title="Re-analyse with Llama">
            {reprioritizing ? '⟳' : '🔄'}
          </button>
          <button className="drd-btn-icon" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="drd-detail-sev-row">
        <SevBadge label={c.severity_label} />
        <span style={{ fontFamily:'var(--font-mono)',fontSize:'0.7rem',color:m.color }}>Score: <b>{c.severity_score||0}/100</b></span>
        <span style={{ fontFamily:'var(--font-mono)',fontSize:'0.7rem',color:u.color }}>⏱ {u.label}</span>
        {a.triage_priority && <span style={{ fontFamily:'var(--font-mono)',fontSize:'0.68rem',color:'var(--text-muted)' }}>{a.triage_priority}</span>}
      </div>

      <div className="drd-detail-complaint">
        <div className="drd-lbl">Chief Complaint</div>
        <div style={{ fontSize:'0.79rem',color:'var(--text-secondary)',fontStyle:'italic',lineHeight:1.5 }}>"{c.chief_complaint}"</div>
        {c.duration && <div style={{ fontSize:'0.65rem',color:'var(--text-muted)',marginTop:4 }}>Duration: {c.duration}</div>}
      </div>

      {c.symptoms?.length > 0 && (
        <div className="drd-detail-section">
          <div className="drd-lbl">Symptoms</div>
          <div className="drd-tags">{c.symptoms.map((s,i) => <span key={i} className="drd-tag">{s}</span>)}</div>
        </div>
      )}

      {a.clinical_summary && (
        <div className="drd-detail-section">
          <div className="drd-lbl">🤖 Llama Clinical Summary</div>
          <div className="drd-ai-text">{a.clinical_summary}</div>
        </div>
      )}

      {a.possible_conditions?.length > 0 && (
        <div className="drd-detail-section">
          <div className="drd-lbl">Possible Conditions</div>
          <div className="drd-tags">
            {a.possible_conditions.map((cond,i) => <span key={i} className="drd-cond-tag">{cond}</span>)}
          </div>
        </div>
      )}

      {a.red_flags?.length > 0 && (
        <div className="drd-detail-section">
          <div className="drd-lbl" style={{ color:'#ff4757' }}>🚩 Red Flags</div>
          {a.red_flags.map((f,i) => <div key={i} className="drd-red-flag">⚠ {f}</div>)}
        </div>
      )}

      {a.doctor_notes && (
        <div className="drd-detail-section">
          <div className="drd-lbl">📋 Notes for You</div>
          <div className="drd-ai-text drd-ai-green">{a.doctor_notes}</div>
        </div>
      )}

      <div className="drd-detail-section">
        <div className="drd-lbl">Routing</div>
        <div className="drd-routing-box" style={{ borderColor:m.border, background:m.bg }}>
          <span style={{ color:m.color, fontSize:'1.1rem' }}>🏥</span>
          <div>
            <div style={{ fontWeight:700, fontSize:'0.84rem' }}>{c.recommended_specialty || 'General Physician'}</div>
            {a.specialty_reason && <div style={{ fontSize:'0.68rem',color:'var(--text-muted)',marginTop:2 }}>{a.specialty_reason}</div>}
          </div>
        </div>
      </div>

      <div className="drd-detail-section">
        <div className="drd-lbl">Doctor Notes</div>
        <textarea className="drd-notes-input" placeholder="Add your notes…" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="drd-detail-actions">
        <button className="drd-btn-primary" onClick={() => handleReview('reviewed')} disabled={reviewing}>
          {reviewing ? 'Saving…' : '✅ Mark Reviewed'}
        </button>
        <button className="drd-btn-secondary" onClick={() => handleReview('resolved')} disabled={reviewing}>
          🏁 Resolve
        </button>
      </div>
    </div>
  )
}

/* ── Mental Health Chatbot (floating) ──────────────────────────── */
const BOT_INTRO = "Hi Doctor! I'm here for your wellbeing too. How are you feeling today? Burnout and stress are common in healthcare — feel free to talk. 💙"
const QUICK_REPLIES = ['Feeling stressed', 'Need a breathing exercise', 'Feeling burnt out', 'Doing well today']

function MentalChatbot() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([{ role: 'bot', text: BOT_INTRO }])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const endRef                  = useRef(null)
  const historyRef              = useRef([])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setSending(true)
    try {
      const res = await mentalAPI.chat({ message: msg, history: historyRef.current.slice(-6) })
      const reply = res.reply || "I'm here for you. Could you tell me more?"
      historyRef.current = [...historyRef.current, { role: 'user', content: msg }, { role: 'assistant', content: reply }]
      setMessages(prev => [...prev, { role: 'bot', text: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: "I'm here to listen. Feel free to share what's on your mind. 💙" }])
    }
    setSending(false)
  }

  return (
    <>
      <button className="drd-chat-fab" onClick={() => setOpen(o => !o)} title="Mental Wellness Chat">
        <span>{open ? '✕' : '🧘'}</span>
        {!open && <span className="drd-chat-fab-label">Wellness</span>}
      </button>
      {open && (
        <div className="drd-chat-panel">
          <div className="drd-chat-header">
            <div>
              <div className="drd-chat-title">🧘 Doctor Wellness Chat</div>
              <div className="drd-chat-sub">Llama 3.3 70B · Confidential</div>
            </div>
            <button className="drd-btn-icon" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="drd-chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`drd-chat-bubble drd-chat-bubble--${m.role}`}>
                {m.role === 'bot' && <span className="drd-chat-avatar">🤖</span>}
                <div className="drd-chat-text">{m.text}</div>
              </div>
            ))}
            {sending && (
              <div className="drd-chat-bubble drd-chat-bubble--bot">
                <span className="drd-chat-avatar">🤖</span>
                <div className="drd-chat-typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="drd-chat-quick">
            {QUICK_REPLIES.map((q, i) => (
              <button key={i} className="drd-chat-quick-btn" onClick={() => send(q)}>{q}</button>
            ))}
          </div>
          <div className="drd-chat-input-row">
            <input className="drd-chat-input" placeholder="How are you feeling…"
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !sending && send()}
              disabled={sending} />
            <button className="drd-chat-send" onClick={() => send()} disabled={sending || !input.trim()}>
              {sending ? '⟳' : '→'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW — main dashboard component
   ═══════════════════════════════════════════════════════════════ */
export default function DoctorDashboard() {
  const { user }  = useAuth()
  const [time, setTime]           = useState(new Date())
  const [doctor, setDoctor]       = useState(null)
  const [showSetup, setShowSetup] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [cases, setCases]         = useState([])
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)
  const [reprioritizing, setReprioritizing] = useState(false)
  const [search, setSearch]       = useState('')
  const [sevFilter, setSevFilter] = useState('all')

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, statsRes] = await Promise.all([
        doctorPortalAPI.getProfile().catch(() => null),
        doctorPortalAPI.getStats().catch(() => null),
      ])
      const doc = profileRes?.doctor || null
      setDoctor(doc)
      setStats(statsRes)
      if (!doc?.specialization) {
        setShowSetup(true)
      } else {
        const recRes = await doctorPortalAPI.getRecommendations(doc.specialization).catch(() => null)
        setCases(recRes?.cases || [])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function saveProfile(data) {
    setSavingProfile(true)
    try {
      await doctorPortalAPI.updateProfile(data)
      setShowSetup(false)
      await loadData()
    } catch (e) { console.error(e) }
    setSavingProfile(false)
  }

  async function handleReprioritize(caseId) {
    setReprioritizing(true)
    try {
      await doctorPortalAPI.reprioritize(caseId)
      const r = await doctorPortalAPI.getRecommendations(doctor?.specialization)
      setCases(r?.cases || [])
      const updated = r?.cases?.find(c => c._id === caseId)
      if (updated) setSelectedCase(updated)
    } catch (e) { console.error(e) }
    setReprioritizing(false)
  }

  async function handleReview(caseId, notes, status) {
    try {
      await doctorPortalAPI.reviewCase({ case_id: caseId, notes, status })
      const r = await doctorPortalAPI.getRecommendations(doctor?.specialization)
      setCases(r?.cases || [])
      setSelectedCase(null)
    } catch (e) { console.error(e) }
  }

  const doctorName     = doctor?.full_name || user?.full_name || 'Doctor'
  const spec           = doctor?.specialization || ''
  const hour           = time.getHours()
  const greeting       = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const emergencyCount = cases.filter(c => c.severity_label === 'emergency').length

  const filteredCases = cases.filter(c => {
    const pat = c.user_id || {}
    const txt = ((pat.full_name||'')+' '+(c.chief_complaint||'')+' '+(c.symptoms||[]).join(' ')).toLowerCase()
    return (!search || txt.includes(search.toLowerCase())) &&
           (sevFilter === 'all' || c.severity_label === sevFilter)
  })

  if (loading) return (
    <div className="page-content drd-root drd-boot">
      <div className="drd-boot-ring"><div className="drd-boot-pulse" /></div>
      <div className="drd-boot-label">Loading clinical data…</div>
    </div>
  )

  return (
    <div className="page-content drd-root">
      {showSetup && <SpecSetupModal onSave={saveProfile} current={doctor} saving={savingProfile} />}

      {/* Header */}
      <div className="drd-header">
        <div>
          <div className="drd-greeting">{greeting}, Dr. {doctorName.split(' ').pop()}</div>
          <div className="drd-subline">
            {spec
              ? <><span className="drd-spec-tag">🏥 {spec}</span> · {doctor?.hospital || 'Clinical Portal'}</>
              : 'Set your specialization to see matched patients'}
          </div>
        </div>
        <div className="drd-header-right">
          <div className="drd-clock-time">{time.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</div>
          {emergencyCount > 0 && (
            <div className="drd-critical-alert">
              <span className="drd-critical-pulse" />
              {emergencyCount} Emergency
            </div>
          )}
          <button className="drd-edit-spec-btn" onClick={() => setShowSetup(true)}>⚕️ {spec || 'Set Specialization'}</button>
          <div className="drd-live"><span className="drd-live-dot" />On duty</div>
        </div>
      </div>

      {emergencyCount > 0 && (
        <div className="drd-emergency-banner">
          🚨 {emergencyCount} EMERGENCY case{emergencyCount > 1 ? 's' : ''} — requires immediate attention
        </div>
      )}

      {/* KPI Row */}
      <div className="drd-kpi-row">
        {[
          { label:'Pending Cases',      val: stats?.stats?.pending_cases  || 0, icon:'📋', color:'#7c5cfc' },
          { label:'Critical/Emergency', val: stats?.stats?.critical_cases || 0, icon:'🚨', color:'#ff4757' },
          { label:"Today's Appts",      val: stats?.stats?.today_appts    || 0, icon:'📅', color:'#00e5b0' },
          { label:'Total Cases',        val: stats?.stats?.total_cases    || 0, icon:'🗃️', color:'#00d4ff' },
          { label:'Completed Appts',    val: stats?.stats?.completed_appts|| 0, icon:'✅', color:'#00e5b0' },
          { label:'Specialization', val: spec || '—', icon:'🏥', color:'#ffb020', noAnim: true },
        ].map((k, i) => (
          <div key={i} className="drd-kpi" style={{ '--kpi-color': k.color }}>
            <div className="drd-kpi-top">
              <span className="drd-kpi-icon">{k.icon}</span>
              <div className="drd-kpi-val" style={{ color: k.color }}>
                {k.noAnim ? k.val : <AnimNum target={typeof k.val === 'number' ? k.val : 0} duration={700 + i * 80} />}
              </div>
            </div>
            <div className="drd-kpi-label">{k.label}</div>
            <div className="drd-kpi-bar">
              <div className="drd-kpi-bar-fill" style={{ background: k.color, width: `${Math.min(100, (typeof k.val === 'number' ? k.val : 0) / Math.max(stats?.stats?.total_cases || 1, 1) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="drd-main-row">
        {/* AI Patient Recommendations */}
        <div className="drd-card">
          <div className="drd-card-header">
            <div>
              <div className="drd-card-title">
                🤖 AI Patient Recommendations
                {spec && <span className="drd-spec-pill">for {spec}</span>}
              </div>
              <div className="drd-card-sub">{filteredCases.length} of {cases.length} · sorted by Llama severity score</div>
            </div>
            <div className="drd-controls">
              <input className="drd-search" placeholder="Search patients…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="drd-filter" value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
                <option value="all">All severity</option>
                <option value="emergency">Emergency</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {cases.length === 0 ? (
            <div className="drd-empty">
              <div className="drd-empty-icon">🔍</div>
              <div className="drd-empty-title">No patient cases yet</div>
              <div className="drd-empty-sub">When patients submit problems from the Patient Dashboard they appear here, prioritised by Llama AI severity scoring.</div>
            </div>
          ) : (
            <div className="drd-case-list">
              {filteredCases.map(c => {
                const m   = SEV[c.severity_label] || SEV.unknown
                const u   = URG[c.urgency] || URG.routine
                const pat = c.user_id || {}
                return (
                  <div key={c._id}
                    className={`drd-case-row${selectedCase?._id === c._id ? ' drd-case-row--selected' : ''}`}
                    style={{ '--sev': m.color }}
                    onClick={() => setSelectedCase(selectedCase?._id === c._id ? null : c)}>
                    <Avatar name={pat.full_name} bg={m.bg} />
                    <div className="drd-case-info">
                      <div className="drd-case-name">{pat.full_name || 'Anonymous'}</div>
                      <div className="drd-case-meta">{pat.age ? `${pat.age}y · ` : ''}{pat.gender || ''}{c.recommended_specialty ? ` · ${c.recommended_specialty}` : ''}</div>
                      <div className="drd-case-complaint">"{c.chief_complaint}"</div>
                      {c.symptoms?.length > 0 && (
                        <div className="drd-tags">
                          {c.symptoms.slice(0, 3).map((s, i) => <span key={i} className="drd-tag">{s}</span>)}
                          {c.symptoms.length > 3 && <span className="drd-tag drd-tag-more">+{c.symptoms.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    <div className="drd-case-right">
                      <SevBadge label={c.severity_label} />
                      <ScoreBar score={c.severity_score || 0} label={c.severity_label} />
                      <span className="drd-urg-tag" style={{ color: u.color }}>⏱ {u.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right col */}
        <div className="drd-right-col">
          {selectedCase ? (
            <CaseDetailPanel
              c={selectedCase}
              onClose={() => setSelectedCase(null)}
              onReprioritize={handleReprioritize}
              reprioritizing={reprioritizing}
              onReview={handleReview}
            />
          ) : (
            <div className="drd-hint-card">
              <div className="drd-empty-icon">👆</div>
              <div className="drd-empty-sub">Click a patient card to see full Llama triage analysis, red flags and routing</div>
            </div>
          )}

          {/* Mini severity chart */}
          {stats?.severity_breakdown?.length > 0 && (
            <div className="drd-card drd-chart-card">
              <div className="drd-card-title" style={{ marginBottom: 12 }}>Severity Breakdown</div>
              <BarChart
                data={stats.severity_breakdown.map(b => ({ label: b._id, count: b.count }))}
                valueKey="count" labelKey="label" color="#7c5cfc" height={120}
              />
            </div>
          )}
        </div>
      </div>

      <div className="drd-disclaimer">⚕️ MediIntel · Llama 3.3 70B · MongoDB · Always verify clinically</div>

      <MentalChatbot />
    </div>
  )
}