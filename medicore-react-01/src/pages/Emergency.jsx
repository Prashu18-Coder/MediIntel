import { useState, useEffect, useRef } from 'react'
import { emergencyAPI } from '../services/api'
import { Card, Button } from '../components/UI'
import { useToast } from '../context/ToastContext'
import './Emergency.css'

export default function Emergency() {
  const toast    = useToast()
  const [phase, setPhase]       = useState('idle')
  const [count, setCount]       = useState(5)
  const [loc, setLoc]           = useState(null)
  const [type, setType]         = useState('general')
  const [log, setLog]           = useState('')
  const [contacts, setContacts] = useState([
    { id: 1, name: 'Emergency Services', phone: '112', relation: 'Emergency' },
  ])
  const [showForm, setShowForm] = useState(false)
  const [cName, setCName] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cRel, setCRel]   = useState('')

  const timer   = useRef(null)
  const counter = useRef(5)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p  => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setLoc({ lat: 17.385, lng: 78.4867 })
    )
    return () => clearInterval(timer.current)
  }, [])

  function startSOS() {
    counter.current = 5
    setCount(5)
    setPhase('countdown')
    setLog('Countdown started...')
    timer.current = setInterval(() => {
      counter.current--
      setCount(counter.current)
      if (counter.current <= 0) {
        clearInterval(timer.current)
        triggerAlert()
      }
    }, 1000)
  }

  function cancel() {
    clearInterval(timer.current)
    counter.current = 5
    setCount(5)
    setPhase('idle')
    setLog('Cancelled.')
  }

  async function triggerAlert() {
    setPhase('sending')
    setLog('Calling /api/emergency/trigger...')
    try {
      const res = await emergencyAPI.trigger({
        alert_type: type,
        location: loc || { lat: 0, lng: 0 },
        message: 'SOS - ' + type,
      })
      setLog('Success: ' + JSON.stringify(res).slice(0, 120))
      setPhase('sent')
    } catch (err) {
      const msg = (err && err.message) || JSON.stringify(err)
      setLog('ERROR: ' + msg)
      toast.error('SOS failed: ' + msg)
      setPhase('error')
    }
  }

  function saveContact() {
    if (!cName.trim()) { toast.warning('Name required'); return }
    setContacts(p => [...p, { id: Date.now(), name: cName, phone: cPhone, relation: cRel }])
    setCName(''); setCPhone(''); setCRel(''); setShowForm(false)
    toast.success(cName + ' added.')
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <span className="label">Emergency Response</span>
        <h1>Emergency SOS</h1>
        <p>One-tap SOS with GPS location sharing.</p>
      </div>

      <div className="emergency-layout">
        <Card className="sos-card">

          {/* Alert type */}
          {(phase === 'idle' || phase === 'error') && (
            <div className="sos-idle">
              <div style={{ width: '100%', marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 8 }}>Alert Type</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {['general','cardiac','stroke','accident','unconscious'].map(t => (
                    <button key={t} onClick={() => setType(t)} style={{
                      padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid ' + (type === t ? 'var(--red)' : 'var(--border-normal)'),
                      background: type === t ? 'rgba(255,71,87,0.12)' : 'var(--bg-surface)',
                      color: type === t ? 'var(--red)' : 'var(--text-secondary)',
                      fontWeight: type === t ? 700 : 400, fontSize: '0.82rem',
                    }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sos-icon-wrap">
                <div className="sos-ring" />
                <button className="sos-btn" onClick={startSOS}>SOS</button>
              </div>
              <h3>Tap SOS to Send Emergency Alert</h3>
              <p>5-second countdown before sending. Cancel if accidental.</p>
              {loc && (
                <div className="location-badge">
                  GPS {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                </div>
              )}
              {log && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 8, wordBreak: 'break-all', maxWidth: 300 }}>
                  {log}
                </div>
              )}
            </div>
          )}

          {/* Countdown */}
          {phase === 'countdown' && (
            <div className="sos-countdown">
              <div className="countdown-ring">
                <span className="countdown-num">{count}</span>
              </div>
              <h3>Sending {type} alert in {count}s...</h3>
              <Button variant="outline" onClick={cancel} style={{ marginTop: 20 }}>
                Cancel Alert
              </Button>
            </div>
          )}

          {/* Sending */}
          {phase === 'sending' && (
            <div className="sos-countdown">
              <div className="countdown-ring" style={{ borderColor: 'var(--amber)' }}>
                <span style={{ fontSize: '1.2rem', color: 'var(--amber)' }}>...</span>
              </div>
              <h3 style={{ color: 'var(--amber)' }}>Sending alert...</h3>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {log}
              </p>
            </div>
          )}

          {/* Sent */}
          {phase === 'sent' && (
            <div className="sos-sent">
              <div className="sent-icon">✓</div>
              <h3 style={{ color: 'var(--green)' }}>Alert Sent!</h3>
              <p>Emergency contacts notified.</p>
              {loc && (
                <div className="location-badge" style={{ borderColor: 'rgba(0,229,176,0.3)', color: 'var(--green)' }}>
                  Location: {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 8, wordBreak: 'break-all', maxWidth: 300 }}>
                {log}
              </div>
              <Button variant="outline" onClick={() => { setPhase('idle'); setLog('') }} style={{ marginTop: 20 }}>
                Done
              </Button>
            </div>
          )}

        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="label" style={{ marginBottom: 0 }}>Emergency Contacts</span>
              <Button variant="outline" size="sm" onClick={() => setShowForm(v => !v)}>
                {showForm ? 'Cancel' : '+ Add'}
              </Button>
            </div>
            {showForm && (
              <div className="contact-form">
                <div className="form-group"><label>NAME</label><input className="input" value={cName} onChange={e => setCName(e.target.value)} placeholder="Name" /></div>
                <div className="form-group"><label>PHONE</label><input className="input" value={cPhone} onChange={e => setCPhone(e.target.value)} placeholder="+91 00000 00000" /></div>
                <div className="form-group"><label>RELATION</label><input className="input" value={cRel} onChange={e => setCRel(e.target.value)} placeholder="e.g. Father" /></div>
                <Button variant="primary" onClick={saveContact}>Save</Button>
              </div>
            )}
            <div className="contacts-list">
              {contacts.map(c => (
                <div key={c.id} className="contact-item">
                  <span className="contact-avatar">👤</span>
                  <div className="contact-info">
                    <div className="contact-name">{c.name}</div>
                    <div className="contact-meta">{c.relation} · {c.phone}</div>
                  </div>
                  <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Active</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <span className="label">Emergency Numbers</span>
            <div style={{ marginTop: 12 }}>
              {[['National Emergency','112'],['Ambulance','108'],['Police','100'],['Fire','101'],['Women Helpline','1091'],['NIMHANS','080-46110007']].map(([label, num]) => (
                <div key={num} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)' }}>{num}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}