import { useState, useEffect } from 'react'
import { doctorPortalAPI } from '../services/api'
import './DoctorDashboard.css'

const APPT_STATUS = {
  confirmed: { color: '#00d4ff', bg: 'rgba(0,212,255,0.1)',  label: 'Confirmed' },
  pending:   { color: '#ffb020', bg: 'rgba(255,176,32,0.1)', label: 'Pending'   },
  completed: { color: '#00e5b0', bg: 'rgba(0,229,176,0.1)', label: 'Completed' },
  cancelled: { color: '#ff4757', bg: 'rgba(255,71,87,0.08)', label: 'Cancelled' },
}
const SEV = {
  emergency: { color:'#ff2d55', bg:'rgba(255,45,85,0.1)',   border:'rgba(255,45,85,0.3)',   label:'EMERGENCY', icon:'🚨' },
  critical:  { color:'#ff4757', bg:'rgba(255,71,87,0.1)',   border:'rgba(255,71,87,0.25)',  label:'CRITICAL',  icon:'⚠️' },
  high:      { color:'#ff6b35', bg:'rgba(255,107,53,0.1)',  border:'rgba(255,107,53,0.25)', label:'HIGH',      icon:'🔴' },
  moderate:  { color:'#ffb020', bg:'rgba(255,176,32,0.1)',  border:'rgba(255,176,32,0.22)', label:'MODERATE',  icon:'🟡' },
  low:       { color:'#00e5b0', bg:'rgba(0,229,176,0.08)',  border:'rgba(0,229,176,0.2)',   label:'LOW',       icon:'🟢' },
  unknown:   { color:'#8fa3c0', bg:'rgba(143,163,192,0.07)',border:'rgba(143,163,192,0.18)',label:'UNKNOWN',  icon:'⚪' },
}

function Avatar({ name, bg }) {
  return (
    <div className="drd-avatar" style={{ background: bg || 'rgba(124,92,252,0.12)', width:38, height:38, fontSize:'0.95rem' }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function SevBadge({ label }) {
  const m = SEV[label] || SEV.unknown
  return (
    <span className="drd-sev-badge" style={{ background: m.bg, border:`1px solid ${m.border}`, color: m.color }}>
      {m.icon} {m.label}
    </span>
  )
}

function PatientProfilePanel({ profile, onClose }) {
  const { patient, cases, symptomChecks, reports, appointments } = profile
  const [tab, setTab] = useState('cases')

  const TABS = [
    { key:'cases',    label:`Cases`,        count: cases?.length || 0 },
    { key:'symptoms', label:`Symptoms`,     count: symptomChecks?.length || 0 },
    { key:'reports',  label:`Reports`,      count: reports?.length || 0 },
    { key:'appts',    label:`Appointments`, count: appointments?.length || 0 },
  ]

  return (
    <div className="drd-card" style={{ borderTop:'2px solid var(--cyan)' }}>
      <div className="drd-detail-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Avatar name={patient?.full_name} bg="rgba(0,212,255,0.12)" />
          <div>
            <div className="drd-detail-name">{patient?.full_name}</div>
            <div className="drd-detail-sub">
              {patient?.age ? `${patient.age}y · ` : ''}{patient?.gender} · {patient?.email}
            </div>
          </div>
        </div>
        <button className="drd-btn-icon" onClick={onClose}>×</button>
      </div>

      {/* Mini tab bar */}
      <div style={{ display:'flex', gap:6, marginBottom:14, borderBottom:'1px solid rgba(255,255,255,0.07)', paddingBottom:2 }}>
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding:'6px 12px', borderRadius:'7px 7px 0 0', border:'1px solid transparent',
              borderBottom:'none', background: tab===t.key ? 'var(--bg-card)' : 'none',
              borderColor: tab===t.key ? 'rgba(0,212,255,0.25)' : 'transparent',
              color: tab===t.key ? 'var(--cyan)' : 'var(--text-muted)',
              fontSize:'0.73rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)',
            }}>
            {t.label} <span style={{ fontSize:'0.65rem', opacity:0.7 }}>({t.count})</span>
          </button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:340, overflowY:'auto' }}>
        {tab === 'cases' && (
          !cases?.length
            ? <div className="drd-empty-sub" style={{ textAlign:'center', padding:20 }}>No cases submitted yet.</div>
            : cases.map((c,i) => (
              <div key={i} style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:8, borderLeft:`3px solid ${SEV[c.severity_label]?.color||'#8fa3c0'}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <SevBadge label={c.severity_label} />
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)' }}>
                    {new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                  </span>
                  <span className="drd-status-tag" style={{
                    background: c.status==='resolved'?'rgba(0,229,176,0.1)':c.status==='pending'?'rgba(255,176,32,0.1)':'rgba(0,212,255,0.08)',
                    color: c.status==='resolved'?'var(--green)':c.status==='pending'?'var(--amber)':'var(--cyan)',
                    marginLeft:'auto'
                  }}>{c.status}</span>
                </div>
                <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)', fontStyle:'italic', marginBottom:3 }}>
                  "{c.chief_complaint}"
                </div>
                {c.recommended_specialty && (
                  <div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>
                    🏥 {c.recommended_specialty} · ⏱ {c.urgency?.replace(/_/g,' ')}
                  </div>
                )}
              </div>
            ))
        )}

        {tab === 'symptoms' && (
          !symptomChecks?.length
            ? <div className="drd-empty-sub" style={{ textAlign:'center', padding:20 }}>No symptom checks yet.</div>
            : symptomChecks.map((s,i) => (
              <div key={i} style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:8 }}>
                <div style={{ fontSize:'0.78rem', color:'var(--text-primary)', marginBottom:3 }}>
                  {(s.symptoms||[]).join(', ')}
                </div>
                <div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>
                  {s.specialist} · {new Date(s.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))
        )}

        {tab === 'reports' && (
          !reports?.length
            ? <div className="drd-empty-sub" style={{ textAlign:'center', padding:20 }}>No reports uploaded yet.</div>
            : reports.map((r,i) => (
              <div key={i} style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:8 }}>
                <div style={{ fontSize:'0.78rem', color:'var(--text-primary)', marginBottom:3 }}>
                  {r.reportType || r.filename || 'Report'}
                </div>
                <div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>
                  {r.abnormal_count||0} abnormal · {new Date(r.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))
        )}

        {tab === 'appts' && (
          !appointments?.length
            ? <div className="drd-empty-sub" style={{ textAlign:'center', padding:20 }}>No appointments yet.</div>
            : appointments.map((a,i) => {
              const sm = APPT_STATUS[a.status] || {}
              return (
                <div key={i} style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:8, display:'flex', alignItems:'flex-start', gap:10 }}>
                  <span className="drd-status-tag" style={{ background:sm.bg, color:sm.color, flexShrink:0, marginTop:2 }}>
                    {sm.label||a.status}
                  </span>
                  <div>
                    <div style={{ fontSize:'0.78rem', color:'var(--text-primary)', fontWeight:600 }}>
                      {a.doctor_name} {a.slot ? `· ${a.slot}` : ''}
                    </div>
                    {a.hospital && <div style={{ fontSize:'0.65rem', color:'var(--cyan)' }}>🏥 {a.hospital}</div>}
                    {a.reason   && <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:2 }}>"{a.reason}"</div>}
                    <div style={{ fontSize:'0.62rem', color:'var(--text-muted)', marginTop:2 }}>
                      {new Date(a.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}
                    </div>
                  </div>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}

export default function DoctorPatients() {
  const [patients,        setPatients]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [search,          setSearch]          = useState('')
  const [selected,        setSelected]        = useState(null)
  const [profile,         setProfile]         = useState(null)
  const [profileLoading,  setProfileLoading]  = useState(false)

  useEffect(() => {
    doctorPortalAPI.getMyPatients()
      .then(r => setPatients(r.patients || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function selectPatient(p) {
    if (selected?._id === p._id) { setSelected(null); setProfile(null); return }
    setSelected(p)
    setProfile(null)
    setProfileLoading(true)
    try {
      const r = await doctorPortalAPI.getPatientProfile(p._id)
      setProfile(r)
    } catch { setProfile(null) }
    setProfileLoading(false)
  }

  const filtered = patients.filter(p => {
    const t = ((p.full_name||'') + ' ' + (p.email||'') + ' ' + (p.chief_complaint||'')).toLowerCase()
    return !search || t.includes(search.toLowerCase())
  })

  return (
    <div className="page-content drd-root">
      {/* Page header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>
            👥 My Patients
          </h2>
          <p style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
            Patients who booked appointments with you or submitted cases matching your specialty
          </p>
        </div>
        <input className="drd-search" placeholder="Search by name, email…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:220 }} />
      </div>

      <div className="drd-main-row">
        {/* Patient list */}
        <div className="drd-card" style={{ minHeight:400 }}>
          {loading ? (
            <div className="drd-loading">Loading patients…</div>
          ) : filtered.length === 0 ? (
            <div className="drd-empty">
              <div className="drd-empty-icon">👥</div>
              <div className="drd-empty-title">No patients yet</div>
              <div className="drd-empty-sub">
                Patients appear here once they book appointments with you (using your name) or submit cases matching your specialty.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:12 }}>
                {filtered.length} patient{filtered.length !== 1 ? 's' : ''} found
              </div>
              {/* Table header */}
              <div style={{
                display:'grid', gridTemplateColumns:'1.8fr 0.9fr 0.9fr 1.1fr 0.9fr',
                gap:12, padding:'8px 14px',
                fontSize:'0.62rem', fontWeight:700, color:'var(--text-muted)',
                textTransform:'uppercase', letterSpacing:'0.07em',
                borderBottom:'1px solid rgba(255,255,255,0.07)',
              }}>
                <span>Patient</span>
                <span>Age / Gender</span>
                <span>Source</span>
                <span>Status</span>
                <span>Last Activity</span>
              </div>

              {/* Table rows */}
              <div style={{ display:'flex', flexDirection:'column' }}>
                {filtered.map(p => {
                  const m  = SEV[p.severity_label] || null
                  const sm = APPT_STATUS[p.status]
                  const isSelected = selected?._id === p._id
                  return (
                    <div key={p._id}
                      onClick={() => selectPatient(p)}
                      style={{
                        display:'grid', gridTemplateColumns:'1.8fr 0.9fr 0.9fr 1.1fr 0.9fr',
                        gap:12, padding:'12px 14px', alignItems:'center',
                        background: isSelected ? 'rgba(124,92,252,0.05)' : 'transparent',
                        borderBottom:'1px solid rgba(255,255,255,0.04)',
                        borderLeft: isSelected ? '3px solid var(--purple)' : '3px solid transparent',
                        cursor:'pointer', transition:'all 0.13s',
                      }}
                      onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background='rgba(255,255,255,0.02)' }}
                      onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background='transparent' }}
                    >
                      <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                        <Avatar name={p.full_name} bg={m?.bg || 'rgba(124,92,252,0.1)'} />
                        <div style={{ minWidth:0 }}>
                          <div className="drd-case-name">{p.full_name || '—'}</div>
                          <div style={{ fontSize:'0.64rem', color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.email}</div>
                        </div>
                      </div>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                        {p.age ? `${p.age}y` : '—'} · {p.gender || '—'}
                      </span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)' }}>
                        {p.source === 'appointment' ? '📅 Appt' : '📋 Case'}
                      </span>
                      <span>
                        {m ? <SevBadge label={p.severity_label} /> :
                          sm ? (
                            <span className="drd-status-tag" style={{ background:sm.bg, color:sm.color }}>
                              {sm.label}
                            </span>
                          ) : <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>—</span>
                        }
                      </span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)' }}>
                        {p.last_visit
                          ? new Date(p.last_visit).toLocaleDateString('en-IN',{ day:'numeric', month:'short', year:'2-digit' })
                          : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Profile panel */}
        <div className="drd-right-col">
          {profileLoading && (
            <div className="drd-card drd-loading">Loading profile…</div>
          )}
          {!profileLoading && selected && profile && (
            <PatientProfilePanel profile={profile} onClose={() => { setSelected(null); setProfile(null) }} />
          )}
          {!selected && !profileLoading && (
            <div className="drd-hint-card">
              <div className="drd-empty-icon">👆</div>
              <div className="drd-empty-sub">
                Click any patient row to view their full health history — cases, reports, symptoms & appointments
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="drd-disclaimer">⚕️ MediIntel · Patient data from MongoDB · Always verify clinically</div>
    </div>
  )
}