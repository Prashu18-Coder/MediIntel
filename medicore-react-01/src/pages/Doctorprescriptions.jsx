import { useState, useEffect } from 'react'
import { prescriptionAPI, doctorPortalAPI } from '../services/api'
import './DoctorDashboard.css'
import './DoctorPrescriptions.css'

const FREQUENCIES = ['Once daily','Twice daily','Three times daily','Four times daily','Every 8 hours','Every 12 hours','Weekly','As needed (SOS)']
const TIMINGS     = ['Morning','Afternoon','Evening','Night','Morning & Night','Morning, Afternoon & Night','Before food','After food','With food']
const DURATIONS   = ['3 days','5 days','7 days','10 days','14 days','1 month','2 months','3 months','Ongoing','As directed']

const EMPTY_MED = { name:'', dosage:'', frequency:'', duration:'', instructions:'', timing:'' }

function Avatar({ name, bg }) {
  return (
    <div className="drd-avatar" style={{ background: bg || 'rgba(0,212,255,0.1)', flexShrink:0 }}>
      {(name||'?').charAt(0).toUpperCase()}
    </div>
  )
}

/* ── Prescription Form ──────────────────────────────────── */
function PrescriptionForm({ onSaved, editRx, patients }) {
  const [patientId,    setPatientId]    = useState(editRx?.patient_user_id?._id || editRx?.patient_user_id || '')
  const [patientName,  setPatientName]  = useState(editRx?.patient_name || '')
  const [diagnosis,    setDiagnosis]    = useState(editRx?.diagnosis || '')
  const [medicines,    setMedicines]    = useState(editRx?.medicines?.length ? editRx.medicines : [{ ...EMPTY_MED }])
  const [tests,        setTests]        = useState((editRx?.tests_advised || []).join(', '))
  const [advice,       setAdvice]       = useState(editRx?.advice || '')
  const [followUp,     setFollowUp]     = useState(editRx?.follow_up || '')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  function addMedicine()    { setMedicines(m => [...m, { ...EMPTY_MED }]) }
  function removeMedicine(i){ setMedicines(m => m.filter((_,idx) => idx !== i)) }
  function updateMed(i, field, val) {
    setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [field]: val } : med))
  }

  // Auto-fill patient name when selecting from dropdown
  function onPatientSelect(id) {
    setPatientId(id)
    const p = patients.find(p => p._id === id)
    if (p) setPatientName(p.full_name)
  }

  async function handleSave() {
    if (!patientId && !patientName.trim()) { setError('Select or enter a patient.'); return }
    if (medicines.some(m => !m.name.trim())) { setError('All medicine rows need a name.'); return }
    setError(''); setSaving(true)
    try {
      const payload = {
        patient_user_id: patientId || undefined,
        patient_name:    patientName.trim(),
        diagnosis:       diagnosis.trim(),
        medicines:       medicines.filter(m => m.name.trim()),
        tests_advised:   tests.split(',').map(t => t.trim()).filter(Boolean),
        advice:          advice.trim(),
        follow_up:       followUp.trim(),
      }
      if (editRx) {
        await prescriptionAPI.update(editRx._id, payload)
      } else {
        await prescriptionAPI.create(payload)
      }
      onSaved()
    } catch(e) { setError(e.message || 'Save failed.') }
    setSaving(false)
  }

  return (
    <div className="rx-form-wrap">
      <div className="rx-form-title">{editRx ? '✏️ Edit Prescription' : '📝 New Prescription'}</div>

      {/* Patient */}
      <div className="rx-section">
        <div className="rx-section-label">Patient</div>
        <div className="rx-row">
          <div className="rx-field rx-field-grow">
            <label>Select from My Patients</label>
            <select className="rx-select" value={patientId} onChange={e => onPatientSelect(e.target.value)}>
              <option value="">— Choose patient —</option>
              {patients.map(p => (
                <option key={p._id} value={p._id}>{p.full_name} {p.age ? `(${p.age}y)` : ''}</option>
              ))}
            </select>
          </div>
          <div className="rx-field rx-field-grow">
            <label>Or type patient name</label>
            <input className="rx-input" placeholder="Patient full name"
              value={patientName} onChange={e => setPatientName(e.target.value)} />
          </div>
        </div>
        <div className="rx-field">
          <label>Diagnosis / Chief Complaint</label>
          <input className="rx-input" placeholder="e.g. Type 2 Diabetes Mellitus, Hypertension"
            value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
        </div>
      </div>

      {/* Medicines */}
      <div className="rx-section">
        <div className="rx-section-label">💊 Medicines</div>
        {medicines.map((med, i) => (
          <div key={i} className="rx-med-card">
            <div className="rx-med-header">
              <span className="rx-med-num">#{i + 1}</span>
              {medicines.length > 1 && (
                <button className="rx-remove-btn" onClick={() => removeMedicine(i)}>✕ Remove</button>
              )}
            </div>
            <div className="rx-row">
              <div className="rx-field rx-field-2x">
                <label>Medicine Name *</label>
                <input className="rx-input" placeholder="e.g. Metformin, Amlodipine"
                  value={med.name} onChange={e => updateMed(i,'name',e.target.value)} />
              </div>
              <div className="rx-field">
                <label>Dosage</label>
                <input className="rx-input" placeholder="e.g. 500mg, 5mg"
                  value={med.dosage} onChange={e => updateMed(i,'dosage',e.target.value)} />
              </div>
            </div>
            <div className="rx-row">
              <div className="rx-field rx-field-grow">
                <label>Frequency</label>
                <select className="rx-select" value={med.frequency} onChange={e => updateMed(i,'frequency',e.target.value)}>
                  <option value="">— Select —</option>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="rx-field rx-field-grow">
                <label>Timing</label>
                <select className="rx-select" value={med.timing} onChange={e => updateMed(i,'timing',e.target.value)}>
                  <option value="">— Select —</option>
                  {TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="rx-field rx-field-grow">
                <label>Duration</label>
                <select className="rx-select" value={med.duration} onChange={e => updateMed(i,'duration',e.target.value)}>
                  <option value="">— Select —</option>
                  {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="rx-field">
              <label>Special Instructions</label>
              <input className="rx-input" placeholder="e.g. Take with a full glass of water, avoid alcohol"
                value={med.instructions} onChange={e => updateMed(i,'instructions',e.target.value)} />
            </div>
          </div>
        ))}
        <button className="rx-add-med-btn" onClick={addMedicine}>+ Add Another Medicine</button>
      </div>

      {/* Tests & Advice */}
      <div className="rx-section">
        <div className="rx-section-label">🔬 Tests & Advice</div>
        <div className="rx-field">
          <label>Tests Advised (comma separated)</label>
          <input className="rx-input" placeholder="e.g. CBC, HbA1c, Lipid Profile, ECG"
            value={tests} onChange={e => setTests(e.target.value)} />
        </div>
        <div className="rx-field">
          <label>General Advice</label>
          <textarea className="rx-textarea" rows={3}
            placeholder="e.g. Avoid spicy food. Walk 30 minutes daily. Monitor BP at home."
            value={advice} onChange={e => setAdvice(e.target.value)} />
        </div>
        <div className="rx-field">
          <label>Follow-up</label>
          <input className="rx-input" placeholder="e.g. After 1 week, After 1 month, As needed"
            value={followUp} onChange={e => setFollowUp(e.target.value)} />
        </div>
      </div>

      {error && <div className="rx-error">{error}</div>}

      <button className="rx-save-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : editRx ? '💾 Update Prescription' : '📋 Issue Prescription'}
      </button>
    </div>
  )
}

/* ── Prescription Card (read view) ──────────────────────── */
function RxCard({ rx, onEdit, onDelete, deleting }) {
  const [expanded, setExpanded] = useState(false)
  const pat = rx.patient_user_id || {}
  const statusColor = rx.status === 'active' ? '#00e5b0' : rx.status === 'completed' ? '#00d4ff' : '#ff4757'

  return (
    <div className="rx-card">
      <div className="rx-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="rx-card-left">
          <Avatar name={rx.patient_name || pat.full_name} bg="rgba(0,229,176,0.1)" />
          <div>
            <div className="rx-card-patient">{rx.patient_name || pat.full_name || 'Patient'}</div>
            <div className="rx-card-meta">
              {rx.diagnosis && <span>📋 {rx.diagnosis}</span>}
              <span>💊 {rx.medicines?.length} medicine{rx.medicines?.length !== 1 ? 's' : ''}</span>
              <span>📅 {new Date(rx.createdAt).toLocaleDateString('en-IN',{ day:'numeric', month:'short', year:'2-digit' })}</span>
            </div>
          </div>
        </div>
        <div className="rx-card-right">
          <span className="rx-status-tag" style={{ background: statusColor+'18', color: statusColor, border:`1px solid ${statusColor}35` }}>
            {rx.status}
          </span>
          <span className="rx-expand-icon">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="rx-card-body">
          {/* Medicines table */}
          <div className="rx-med-table-wrap">
            <div className="rx-med-table-title">💊 Prescribed Medicines</div>
            <div className="rx-med-table">
              <div className="rx-med-table-head">
                <span>Medicine</span><span>Dosage</span><span>Frequency</span><span>Timing</span><span>Duration</span>
              </div>
              {rx.medicines?.map((m, i) => (
                <div key={i} className="rx-med-table-row">
                  <span className="rx-med-name">{m.name}</span>
                  <span>{m.dosage || '—'}</span>
                  <span>{m.frequency || '—'}</span>
                  <span>{m.timing || '—'}</span>
                  <span>{m.duration || '—'}</span>
                </div>
              ))}
            </div>
            {rx.medicines?.some(m => m.instructions) && (
              <div className="rx-instructions">
                {rx.medicines.filter(m=>m.instructions).map((m,i) => (
                  <div key={i} style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:3 }}>
                    <strong style={{ color:'var(--text-secondary)' }}>{m.name}:</strong> {m.instructions}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tests */}
          {rx.tests_advised?.length > 0 && (
            <div className="rx-detail-section">
              <div className="rx-detail-label">🔬 Tests Advised</div>
              <div className="rx-tags">
                {rx.tests_advised.map((t,i) => <span key={i} className="rx-test-tag">{t}</span>)}
              </div>
            </div>
          )}

          {/* Advice */}
          {rx.advice && (
            <div className="rx-detail-section">
              <div className="rx-detail-label">📝 Advice</div>
              <div className="rx-advice-text">{rx.advice}</div>
            </div>
          )}

          {/* Follow up */}
          {rx.follow_up && (
            <div className="rx-detail-section">
              <div className="rx-detail-label">📅 Follow-up</div>
              <div style={{ fontSize:'0.78rem', color:'var(--cyan)' }}>{rx.follow_up}</div>
            </div>
          )}

          <div className="rx-card-actions">
            <button className="drd-btn-primary" onClick={() => onEdit(rx)}>✏️ Edit</button>
            <button className="drd-btn-secondary" onClick={() => onDelete(rx._id)} disabled={deleting === rx._id}>
              {deleting === rx._id ? 'Deleting…' : '🗑 Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export default function DoctorPrescriptions() {
  const [view,       setView]       = useState('list')   // 'list' | 'new' | 'edit'
  const [rxList,     setRxList]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [editRx,     setEditRx]     = useState(null)
  const [patients,   setPatients]   = useState([])
  const [search,     setSearch]     = useState('')
  const [deleting,   setDeleting]   = useState(null)

  async function loadAll() {
    setLoading(true)
    try {
      const [rxRes, patRes] = await Promise.all([
        prescriptionAPI.list(),
        doctorPortalAPI.getMyPatients(),
      ])
      setRxList(rxRes.prescriptions || [])
      setPatients(patRes.patients || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function handleDelete(id) {
    setDeleting(id)
    try {
      await prescriptionAPI.delete(id)
      setRxList(prev => prev.filter(r => r._id !== id))
    } catch {}
    setDeleting(null)
  }

  function handleEdit(rx) { setEditRx(rx); setView('edit') }
  function handleNew()     { setEditRx(null); setView('new') }
  function handleSaved()   { loadAll(); setView('list') }

  const filtered = rxList.filter(rx => {
    const t = ((rx.patient_name||'') + ' ' + (rx.diagnosis||'')).toLowerCase()
    return !search || t.includes(search.toLowerCase())
  })

  if (view === 'new' || view === 'edit') {
    return (
      <div className="page-content drd-root">
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:4 }}>
          <button className="drd-btn-secondary" onClick={() => setView('list')} style={{ padding:'6px 14px' }}>
            ← Back
          </button>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', fontWeight:700, color:'var(--text-primary)' }}>
            {view === 'edit' ? 'Edit Prescription' : 'New Prescription'}
          </h2>
        </div>
        <PrescriptionForm
          onSaved={handleSaved}
          editRx={editRx}
          patients={patients}
        />
      </div>
    )
  }

  return (
    <div className="page-content drd-root">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>
            📋 Prescriptions
          </h2>
          <p style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
            {rxList.length} prescription{rxList.length !== 1 ? 's' : ''} issued · stored in MongoDB · visible to patients
          </p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input className="drd-search" placeholder="Search patient, diagnosis…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ width:210 }} />
          <button className="rx-new-btn" onClick={handleNew}>+ New Prescription</button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="drd-loading" style={{ padding:60 }}>Loading prescriptions…</div>
      ) : filtered.length === 0 ? (
        <div className="drd-empty" style={{ padding:60 }}>
          <div className="drd-empty-icon">📋</div>
          <div className="drd-empty-title">{rxList.length === 0 ? 'No prescriptions yet' : 'No results found'}</div>
          <div className="drd-empty-sub">
            {rxList.length === 0
              ? 'Click "New Prescription" to write your first prescription. Patients will be able to view it in their dashboard.'
              : 'Try a different search term.'}
          </div>
          {rxList.length === 0 && (
            <button className="rx-new-btn" onClick={handleNew} style={{ marginTop:16 }}>+ Write First Prescription</button>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(rx => (
            <RxCard key={rx._id} rx={rx} onEdit={handleEdit} onDelete={handleDelete} deleting={deleting} />
          ))}
        </div>
      )}

      <div className="drd-disclaimer">⚕️ MediIntel · Prescriptions stored in MongoDB · Patients can view these in their dashboard</div>
    </div>
  )
}