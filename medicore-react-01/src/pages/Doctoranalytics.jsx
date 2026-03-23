import { useState, useEffect, useRef, useCallback } from 'react'
import { doctorPortalAPI } from '../services/api'
import './DoctorDashboard.css'

/* ── Animated Number ─────────────────────────────────────────── */
function AnimNum({ target, duration = 900, suffix = '' }) {
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
  return <>{val}{suffix}</>
}

/* ── Bar Chart ───────────────────────────────────────────────── */
function BarChart({ data, valueKey, labelKey, color = '#7c5cfc', height = 190 }) {
  const ref = useRef(null)
  const [hov, setHov] = useState(null)
  const vals = data.map(d => d[valueKey] || 0)
  const max  = Math.max(...vals, 1) * 1.18

  const draw = useCallback((hIdx) => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr; c.height = rect.height * dpr; ctx.scale(dpr, dpr)
    const W = rect.width, H = rect.height
    const pad = { t: 20, r: 10, b: 32, l: 38 }
    const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b
    const bW = iW / data.length, gap = bW * 0.3
    ctx.clearRect(0, 0, W, H)

    // Grid lines
    ctx.setLineDash([4, 6])
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (iH / 4) * i
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.font = '9px monospace'; ctx.textAlign = 'right'
      ctx.fillText(Math.round(max - (max / 4) * i), pad.l - 5, y + 3)
    }
    ctx.setLineDash([])

    // Bars
    data.forEach((d, i) => {
      const bH = ((d[valueKey] || 0) / max) * iH
      const x = pad.l + i * bW + gap / 2
      const y = pad.t + iH - bH
      const w = bW - gap
      const isH = hIdx === i
      if (bH < 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.beginPath(); ctx.roundRect(x, pad.t + iH - 2, w, 2, 1); ctx.fill()
      } else {
        const g = ctx.createLinearGradient(0, y, 0, y + bH)
        g.addColorStop(0, isH ? color : color + 'cc')
        g.addColorStop(1, color + '20')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.roundRect(x, y, w, bH, [4, 4, 0, 0]); ctx.fill()
      }
      // Hover tooltip
      if (isH && bH > 0) {
        const tx = Math.max(pad.l + 2, Math.min(x + w / 2 - 28, W - 62))
        const ty = Math.max(4, y - 28)
        ctx.fillStyle = '#131e33'; ctx.strokeStyle = color + '80'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.roundRect(tx, ty, 56, 22, 5); ctx.fill(); ctx.stroke()
        ctx.fillStyle = color; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'
        ctx.fillText(d[valueKey] || 0, tx + 28, ty + 9)
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '8px monospace'
        ctx.fillText((d[labelKey] || '').toString().slice(0, 6), tx + 28, ty + 19)
      }
      // X labels
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
      ctx.fillText((d[labelKey] || '').toString().slice(0, 4), x + w / 2, H - pad.b + 16)
    })
  }, [data, valueKey, labelKey, color])

  useEffect(() => { draw(hov) }, [draw, hov])
  useEffect(() => {
    const obs = new ResizeObserver(() => draw(hov))
    if (ref.current) obs.observe(ref.current.parentElement)
    return () => obs.disconnect()
  }, [draw, hov])

  function onMove(e) {
    const c = ref.current; if (!c) return
    const rect = c.getBoundingClientRect()
    const iW = rect.width - 48, bW = iW / data.length
    setHov(Math.max(0, Math.min(data.length - 1, Math.floor((e.clientX - rect.left - 38) / bW))))
  }

  return (
    <canvas ref={ref}
      style={{ width: '100%', height, cursor: 'crosshair', display: 'block' }}
      onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
  )
}

/* ── Breakdown Card ──────────────────────────────────────────── */
function BreakdownCard({ title, items, total, colorMap }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { setTimeout(() => setAnimated(true), 100) }, [])

  return (
    <div className="drd-card">
      <div className="drd-card-title" style={{ marginBottom: 18 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((b, i) => {
          const color = colorMap?.[b._id] || `hsl(${200 + i * 38}, 65%, 58%)`
          const pct   = Math.round((b.count / Math.max(total, 1)) * 100)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color,
                minWidth: 110, textTransform: 'capitalize',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {(b._id || 'unknown').replace(/_/g, ' ')}
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1, height: 8, background: 'rgba(255,255,255,0.05)',
                  borderRadius: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    width: animated ? `${pct}%` : '0%',
                    height: '100%', background: color,
                    borderRadius: 4,
                    transition: `width ${0.7 + i * 0.08}s cubic-bezier(0.16,1,0.3,1)`,
                    boxShadow: `0 0 8px ${color}50`,
                  }} />
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                  color: 'var(--text-secondary)', minWidth: 22, textAlign: 'right', fontWeight: 600,
                }}>
                  {b.count}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
                  color: 'var(--text-muted)', minWidth: 32, textAlign: 'right',
                }}>
                  {pct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Status Summary Card ─────────────────────────────────────── */
function StatusCard({ items, colorMap }) {
  return (
    <div className="drd-card">
      <div className="drd-card-title" style={{ marginBottom: 18 }}>Case Status</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {items.map((b, i) => {
          const color = colorMap?.[b._id] || '#8fa3c0'
          return (
            <div key={i} style={{
              padding: '16px 12px', borderRadius: 10, textAlign: 'center',
              background: color + '0d',
              border: `1px solid ${color}35`,
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '1.8rem',
                fontWeight: 800, color, lineHeight: 1, marginBottom: 6,
              }}>
                {b.count}
              </div>
              <div style={{
                fontSize: '0.7rem', color: 'var(--text-secondary)',
                fontWeight: 600, textTransform: 'capitalize',
              }}>
                {b._id}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function DoctorAnalytics() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    doctorPortalAPI.getAnalytics()
      .then(r => setData(r))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="page-content drd-root">
      <div className="drd-loading" style={{ padding: 80, textAlign: 'center' }}>
        Loading analytics…
      </div>
    </div>
  )

  if (!data) return (
    <div className="page-content drd-root">
      <div className="drd-empty" style={{ padding: 80 }}>
        <div className="drd-empty-icon">📊</div>
        <div className="drd-empty-title">No analytics data yet</div>
        <div className="drd-empty-sub">Data will appear once patients start submitting cases and booking appointments.</div>
      </div>
    </div>
  )

  const { stats, severity_breakdown, specialty_breakdown, urgency_breakdown, status_breakdown, monthly_trend } = data

  const SEV_COLORS  = { emergency:'#ff2d55', critical:'#ff4757', high:'#ff6b35', moderate:'#ffb020', low:'#00e5b0', unknown:'#8fa3c0' }
  const URG_COLORS  = { immediate:'#ff2d55', within_48h:'#ff6b35', within_week:'#ffb020', routine:'#00e5b0' }
  const STAT_COLORS = { pending:'#ffb020', reviewed:'#00d4ff', resolved:'#00e5b0' }
  const totalCases  = stats?.total_cases || 1

  const KPI = [
    { label:'Total Cases',     val:stats?.total_cases     || 0, color:'#7c5cfc', icon:'🗃️' },
    { label:'Pending',         val:stats?.pending_cases   || 0, color:'#ffb020', icon:'⏳' },
    { label:'Critical',        val:stats?.critical_cases  || 0, color:'#ff4757', icon:'🚨' },
    { label:'Total Appts',     val:stats?.total_appts     || 0, color:'#00d4ff', icon:'📅' },
    { label:"Today's Appts",   val:stats?.today_appts     || 0, color:'#00e5b0', icon:'📆' },
    { label:'Completed Appts', val:stats?.completed_appts || 0, color:'#00e5b0', icon:'✅' },
  ]

  return (
    <div className="page-content drd-root">

      {/* Page header */}
      <div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>
          📈 Analytics
        </h2>
        <p style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
          Live data from MongoDB — cases, appointments, severity &amp; specialty trends
        </p>
      </div>

      {/* KPI row */}
      <div className="drd-kpi-row">
        {KPI.map((k, i) => (
          <div key={i} className="drd-kpi" style={{ '--kpi-color': k.color }}>
            <div className="drd-kpi-top">
              <span className="drd-kpi-icon">{k.icon}</span>
              <div className="drd-kpi-val" style={{ color: k.color }}>
                <AnimNum target={k.val} duration={700 + i * 80} />
              </div>
            </div>
            <div className="drd-kpi-label">{k.label}</div>
            <div className="drd-kpi-bar">
              <div className="drd-kpi-bar-fill" style={{
                background: k.color,
                width: `${Math.min(100, (k.val / totalCases) * 100)}%`,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Monthly trend — full width */}
      {monthly_trend?.length > 0 && (
        <div className="drd-card">
          <div className="drd-card-title" style={{ marginBottom: 4 }}>📊 Monthly Case Trend</div>
          <div className="drd-card-sub" style={{ marginBottom: 16 }}>Last 6 months — hover bars for details</div>
          <BarChart data={monthly_trend} valueKey="cases" labelKey="label" color="#7c5cfc" height={190} />
        </div>
      )}

      {/* 2-col breakdown grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

        {severity_breakdown?.length > 0 && (
          <BreakdownCard
            title="Severity Distribution"
            items={severity_breakdown}
            total={totalCases}
            colorMap={SEV_COLORS}
          />
        )}

        {urgency_breakdown?.length > 0 && (
          <BreakdownCard
            title="Urgency Breakdown"
            items={urgency_breakdown}
            total={totalCases}
            colorMap={URG_COLORS}
          />
        )}

        {specialty_breakdown?.length > 0 && (
          <BreakdownCard
            title="Top Specialty Demands"
            items={specialty_breakdown}
            total={specialty_breakdown.reduce((s, b) => s + b.count, 0)}
          />
        )}

        {status_breakdown?.length > 0 && (
          <StatusCard items={status_breakdown} colorMap={STAT_COLORS} />
        )}
      </div>

      <div className="drd-disclaimer">
        ⚕️ MediIntel · All analytics data sourced from MongoDB in real-time
      </div>
    </div>
  )
}