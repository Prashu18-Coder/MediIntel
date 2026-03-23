import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { medicineAPI } from '../services/api'
import { Card, Button, Badge } from '../components/UI'
import './Medicines.css'

const COLORS = ['#00d4ff','#00e5b0','#7c5cfc','#ffb020','#ff4757']

function toAmPm(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour  = h % 12 || 12
  return hour + ':' + String(m).padStart(2, '0') + ' ' + ampm
}

const MOCK = [
  { id: '1', name: 'Metformin',    dose: '500mg',    frequency: 'Twice daily', time: '08:00', taken: true,  color: '#00d4ff' },
  { id: '2', name: 'Atorvastatin', dose: '10mg',     frequency: 'Once daily',  time: '22:00', taken: false, color: '#00e5b0' },
  { id: '3', name: 'Vitamin D3',   dose: '60,000 IU',frequency: 'Weekly',      time: '09:00', taken: false, color: '#ffb020' },
]

function MedReminderToast({ med, onTake, onSnooze }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: med.color, flexShrink: 0, display: 'inline-block'
        }} />
        <div>
          <div style={{ fontWeight: 700, color: '#e8f0fe', fontSize: '0.9rem' }}>
            Time to take {med.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#8fa3c0', marginTop: 2 }}>
            {med.dose}  {med.frequency}  {toAmPm(med.time)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onTake}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
            background: med.color, color: '#060b18',
            fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          Mark Taken
        </button>
        <button
          onClick={onSnooze}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8,
            border: '1px solid rgba(0,212,255,0.25)', background: 'transparent',
            color: '#8fa3c0', fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          Snooze 10 min
        </button>
      </div>
    </div>
  )
}

export default function Medicines() {
  const [meds, setMeds]         = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName]         = useState('')
  const [dose, setDose]         = useState('')
  const [freq, setFreq]         = useState('Once daily')
  const [time, setTime]         = useState('08:00')
  const notifiedRef = useRef(new Set())
  const snoozeRef   = useRef({})
  const medsRef     = useRef([])

  // Keep medsRef in sync so interval always sees latest medicines
  useEffect(() => { medsRef.current = meds }, [meds])

  useEffect(() => {
    medicineAPI.list()
      .then(r => setMeds(r.medicines || []))
      .catch(() => setMeds(MOCK))
  }, [])

  // ── Reminder checker ──────────────────────────────────────────────────────
  // Fires every 10 seconds so we never miss a minute
  useEffect(() => {
    function checkReminders() {
      const now  = new Date()
      const hhmm = now.getHours().toString().padStart(2, '0') + ':' +
                   now.getMinutes().toString().padStart(2, '0')
      // Key resets each day so reminders fire again next day
      const dateKey = now.toDateString()

      medsRef.current.forEach(med => {
        if (med.taken) return
        if (med.time !== hhmm) return

        const key = med.id + '_' + hhmm + '_' + dateKey
        if (notifiedRef.current.has(key)) return
        if (snoozeRef.current[med.id] && snoozeRef.current[med.id] > Date.now()) return

        notifiedRef.current.add(key)

        toast.custom((t) => (
          <div style={{
            background:   '#131e33',
            border:       '1px solid ' + med.color + '88',
            borderRadius: '14px',
            padding:      '14px 16px',
            boxShadow:    '0 8px 32px rgba(0,0,0,0.5), 0 0 20px ' + med.color + '33',
            minWidth:     260,
            maxWidth:     320,
            opacity:      t.visible ? 1 : 0,
            transition:   'opacity 0.2s ease',
          }}>
            <MedReminderToast
              med={med}
              onTake={() => {
                toast.dismiss(t.id)
                setMeds(prev => prev.map(m => m.id === med.id ? { ...m, taken: true } : m))
                medicineAPI.toggle(med.id).catch(() => {})
                toast.success(med.name + ' marked as taken!', { duration: 2500 })
              }}
              onSnooze={() => {
                toast.dismiss(t.id)
                snoozeRef.current[med.id] = Date.now() + 10 * 60 * 1000
                toast('Snoozed 10 minutes', {
                  icon: '⏰', duration: 2000,
                  style: { borderColor: 'rgba(255,176,32,0.3)' }
                })
              }}
            />
          </div>
        ), { duration: 60000, id: 'med_' + med.id })
      })
    }

    // Check immediately on mount, then every 10 seconds
    checkReminders()
    const interval = setInterval(checkReminders, 10000)
    return () => clearInterval(interval)
  }, [])  // empty deps — uses medsRef so never goes stale

  // ── Actions ───────────────────────────────────────────────────────────────
  const taken = meds.filter(m => m.taken).length
  const pct   = meds.length ? (taken / meds.length) * 100 : 0

  async function toggle(id) {
    const med = meds.find(m => m.id === id)
    const nowTaken = !med.taken
    setMeds(prev => prev.map(m => m.id === id ? { ...m, taken: nowTaken } : m))
    try { await medicineAPI.toggle(id) } catch {}
    if (nowTaken) {
      toast.success(med.name + ' marked as taken!', { duration: 2500 })
    }
  }

  async function deleteMed(id) {
    const med = meds.find(m => m.id === id)
    setMeds(prev => prev.filter(m => m.id !== id))
    try { await medicineAPI.delete(id) } catch {}
    toast.success((med ? med.name : 'Medicine') + ' reminder removed.')
  }

  async function addMed() {
    if (!name.trim()) {
      toast.error('Medicine name is required.')
      return
    }
    const newMed = {
      name: name.trim(), dose, frequency: freq, time, taken: false,
      color: COLORS[meds.length % COLORS.length]
    }
    try {
      const res = await medicineAPI.add(newMed)
      setMeds(prev => [...prev, res.id ? res : { ...newMed, id: Date.now().toString() }])
    } catch {
      setMeds(prev => [...prev, { ...newMed, id: Date.now().toString() }])
    }
    toast.success(name + ' added! You will be reminded at ' + time)
    setName(''); setDose(''); setFreq('Once daily'); setTime('08:00')
    setShowForm(false)
  }

  // Test notification button
  function testReminder() {
    const testMed = meds.find(m => !m.taken) || { id: 'test', name: 'Test Medicine', dose: '500mg', frequency: 'Once daily', time: '08:00', color: '#00d4ff' }
    toast.custom((t) => (
      <div style={{
        background:   '#131e33',
        border:       '1px solid ' + testMed.color + '55',
        borderRadius: '14px',
        padding:      '14px 16px',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.5)',
        minWidth:     260,
        maxWidth:     320,
      }}>
        <MedReminderToast
          med={testMed}
          onTake={() => { toast.dismiss(t.id); toast.success('Marked as taken!') }}
          onSnooze={() => { toast.dismiss(t.id); toast('Snoozed 10 min', { icon: '⏰' }) }}
        />
      </div>
    ), { duration: 10000 })
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ position: 'relative' }}>
          <span className="label">Medication Tracker</span>
          <h1>Medicine Reminders</h1>
          <p>Track your medication schedule and get notified at the right time.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" onClick={testReminder} title="Preview reminder notification">
            Test Reminder
          </Button>
          <Button variant="primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : '+ Add Medicine'}
          </Button>
        </div>
      </div>

      {/* Adherence bar */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="label" style={{ marginBottom: 0 }}>Today's Adherence</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--cyan)' }}>
            {taken}/{meds.length}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{
            width: pct + '%',
            background: pct === 100 ? 'var(--green)' : 'var(--cyan)'
          }} />
        </div>
        {pct === 100 && meds.length > 0 && (
          <p style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--green)', textAlign: 'center' }}>
            All medicines taken today!
          </p>
        )}
      </Card>

      {/* Add form */}
      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <span className="label">New Medication</span>
          <div className="med-form-grid">
            <div className="form-group">
              <label>MEDICINE NAME</label>
              <input className="input" placeholder="e.g. Aspirin" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>DOSE</label>
              <input className="input" placeholder="e.g. 500mg" value={dose} onChange={e => setDose(e.target.value)} />
            </div>
            <div className="form-group">
              <label>FREQUENCY</label>
              <select className="input" value={freq} onChange={e => setFreq(e.target.value)}>
                <option>Once daily</option>
                <option>Twice daily</option>
                <option>Three times daily</option>
                <option>Weekly</option>
                <option>As needed</option>
              </select>
            </div>
            <div className="form-group">
              <label>REMINDER TIME</label>
              <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <Button variant="primary" onClick={addMed}>Save Medicine</Button>
        </Card>
      )}

      {/* Medicine list */}
      <div className="med-list">
        {meds.length === 0 && (
          <Card>
            <p style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              No medicines yet — add your first reminder.
            </p>
          </Card>
        )}
        {meds.map(m => (
          <Card key={m.id} className={'med-item' + (m.taken ? ' taken' : '')} style={{ borderLeftColor: m.color }}>
            <button
              className={'med-check' + (m.taken ? ' checked' : '')}
              style={{ borderColor: m.color, color: m.color }}
              onClick={() => toggle(m.id)}
            >
              {m.taken ? '✓' : ''}
            </button>
            <div className="med-info">
              <div className="med-name">
                {m.name}
                <Badge variant="cyan" style={{ marginLeft: 8, fontSize: '0.7rem' }}>{m.dose}</Badge>
              </div>
              <div className="med-meta">{m.frequency}</div>
            </div>
            <span className="med-time" style={{ color: m.color }}>{toAmPm(m.time)}</span>
            <button className="med-del" onClick={() => deleteMed(m.id)} title="Delete">🗑️</button>
          </Card>
        ))}
      </div>
    </div>
  )
}