import { useState, useEffect, useCallback } from 'react'
import { doctorPortalAPI } from '../services/api'
import './DoctorDashboard.css'

const STATUS_META = {
  confirmed: { color:'#00d4ff', bg:'rgba(0,212,255,0.1)',  label:'Confirmed' },
  pending:   { color:'#ffb020', bg:'rgba(255,176,32,0.1)', label:'Pending'   },
  completed: { color:'#00e5b0', bg:'rgba(0,229,176,0.1)', label:'Completed' },
  cancelled: { color:'#ff4757', bg:'rgba(255,71,87,0.08)', label:'Cancelled' },
}

function Avatar({ name }) {
  return (
    <div className="drd-avatar" style={{ background:'rgba(0,212,255,0.1)', flexShrink:0 }}>
      {(name||'?').charAt(0).toUpperCase()}
    </div>
  )
}

export default function DoctorAppointments() {
  const [appts,    setAppts]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [updating, setUpdating] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await doctorPortalAPI.getAppointments(filter)
      setAppts(r.appointments || [])
    } catch {}
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function updateStatus(id, status) {
    setUpdating(id)
    try {
      await doctorPortalAPI.updateAppointment(id, { status })
      setAppts(prev => prev.map(a => a._id === id ? { ...a, status } : a))
    } catch {}
    setUpdating(null)
  }

  const filtered = appts.filter(a => {
    const pat = a.user_id || {}
    const t = ((pat.full_name||'') + ' ' + (a.reason||'') + ' ' + (a.specialty||'') + ' ' + (a.doctor_name||'')).toLowerCase()
    return !search || t.includes(search.toLowerCase())
  })

  const counts = appts.reduce((acc,a) => { acc[a.status] = (acc[a.status]||0)+1; return acc }, {})
  const FILTERS = ['all','pending','confirmed','completed','cancelled']

  return (
    <div className="page-content drd-root">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>
            📅 Appointments
          </h2>
          <p style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
            {appts.length} total · {counts.confirmed||0} confirmed · {counts.completed||0} completed · {counts.pending||0} pending
          </p>
        </div>
        <input className="drd-search" placeholder="Search patient, reason…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:220 }} />
      </div>

      {/* Filter pills */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {FILTERS.map(s => {
          const sm = STATUS_META[s]
          const count = s === 'all' ? appts.length : (counts[s]||0)
          return (
            <button key={s}
              onClick={() => setFilter(s)}
              style={{
                padding:'6px 14px', borderRadius:20,
                border: filter===s
                  ? `1px solid ${sm?.color||'rgba(124,92,252,0.5)'}`
                  : '1px solid rgba(255,255,255,0.08)',
                background: filter===s
                  ? (sm?.bg||'rgba(124,92,252,0.1)')
                  : 'rgba(255,255,255,0.03)',
                color: filter===s ? (sm?.color||'var(--purple)') : 'var(--text-muted)',
                fontSize:'0.74rem', fontWeight:600, cursor:'pointer',
                fontFamily:'var(--font-body)', transition:'all 0.14s',
                display:'flex', alignItems:'center', gap:6,
              }}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}
              <span style={{
                background:'rgba(255,255,255,0.12)', borderRadius:10,
                padding:'1px 6px', fontSize:'0.62rem',
              }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="drd-card">
        {loading ? (
          <div className="drd-loading">Loading appointments…</div>
        ) : filtered.length === 0 ? (
          <div className="drd-empty">
            <div className="drd-empty-icon">📅</div>
            <div className="drd-empty-title">No appointments found</div>
            <div className="drd-empty-sub">
              Appointments booked by patients using your name will appear here. Make sure your full name in your profile matches what patients enter.
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(a => {
              const pat = a.user_id || {}
              const sm  = STATUS_META[a.status] || STATUS_META.pending
              const isUpdating = updating === a._id

              return (
                <div key={a._id} style={{
                  display:'grid',
                  gridTemplateColumns:'40px 1fr 130px 110px auto',
                  gap:14, alignItems:'center',
                  padding:'14px 16px',
                  background:'var(--bg-surface)',
                  border:'1px solid rgba(255,255,255,0.07)',
                  borderLeft:`3px solid ${sm.color}`,
                  borderRadius:11,
                  transition:'background 0.13s',
                }}>
                  {/* Avatar */}
                  <Avatar name={pat.full_name} />

                  {/* Patient + reason */}
                  <div style={{ minWidth:0 }}>
                    <div className="drd-case-name">{pat.full_name || 'Patient'}</div>
                    <div className="drd-case-meta">
                      {pat.age ? `${pat.age}y · ` : ''}{pat.gender || ''}{a.specialty ? ` · ${a.specialty}` : ''}
                    </div>
                    {a.doctor_name && (
                      <div style={{ fontSize:'0.7rem', color:'var(--cyan)', marginTop:2 }}>
                        👨‍⚕️ {a.doctor_name}{a.hospital ? ` · ${a.hospital}` : ''}
                      </div>
                    )}
                    {a.reason && (
                      <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)', fontStyle:'italic', marginTop:3 }}>
                        "{a.reason}"
                      </div>
                    )}
                    {a.notes && (
                      <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:2 }}>
                        📝 {a.notes}
                      </div>
                    )}
                  </div>

                  {/* Slot + date */}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.8rem', fontWeight:600, color:'var(--text-primary)' }}>
                      {a.slot || '—'}
                    </div>
                    {a.date && (
                      <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:2 }}>{a.date}</div>
                    )}
                    <div style={{ fontSize:'0.62rem', color:'var(--text-muted)', marginTop:2 }}>
                      {new Date(a.createdAt).toLocaleDateString('en-IN',{ day:'numeric', month:'short', year:'2-digit' })}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className="drd-status-tag" style={{ background:sm.bg, color:sm.color, alignSelf:'flex-start', marginTop:2 }}>
                    {sm.label}
                  </span>

                  {/* Action buttons */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end' }}>
                    {a.status === 'pending' && (
                      <button className="drd-btn-xs drd-btn-xs-blue"
                        disabled={isUpdating}
                        onClick={() => updateStatus(a._id, 'confirmed')}>
                        ✓ Confirm
                      </button>
                    )}
                    {a.status === 'confirmed' && (
                      <button className="drd-btn-xs drd-btn-xs-green"
                        disabled={isUpdating}
                        onClick={() => updateStatus(a._id, 'completed')}>
                        ✓ Complete
                      </button>
                    )}
                    {(a.status === 'pending' || a.status === 'confirmed') && (
                      <button className="drd-btn-xs drd-btn-xs-red"
                        disabled={isUpdating}
                        onClick={() => updateStatus(a._id, 'cancelled')}>
                        ✗ Cancel
                      </button>
                    )}
                    {isUpdating && (
                      <span style={{ fontSize:'0.62rem', color:'var(--text-muted)' }}>Saving…</span>
                    )}
                    {(a.status === 'completed' || a.status === 'cancelled') && (
                      <span style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="drd-disclaimer">⚕️ MediIntel · Appointments stored in MongoDB · Status updates saved immediately</div>
    </div>
  )
}