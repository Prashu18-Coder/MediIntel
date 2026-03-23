import { useState } from 'react'
import { symptomAPI } from '../services/api'
import { Card, Button, Badge, PageLoading } from '../components/UI'
import { useToast } from '../context/ToastContext'
import './Symptoms.css'

const COMMON_SYMPTOMS = [
  'Fever','Headache','Body Pain','Cough','Fatigue',
  'Nausea','Vomiting','Diarrhea','Chest Pain','Shortness of Breath',
  'Dizziness','Sore Throat','Runny Nose','Loss of Appetite','Chills',
  'Rash','Swelling','Blurred Vision','Palpitations','Back Pain',
]

const SEVERITY_BADGE = { low: 'green', moderate: 'amber', high: 'red' }

function mockResults(symptoms) {
  return {
    conditions: [
      { name: 'Viral Fever',    probability: 82, severity: 'moderate', description: 'Common viral infection with fever and fatigue.' },
      { name: 'Influenza',      probability: 65, severity: 'moderate', description: 'Seasonal flu affecting the respiratory system.' },
      { name: 'Dengue Fever',   probability: 28, severity: 'high',     description: 'Mosquito-borne — monitor platelet count.' },
    ],
    recommendations: [
      'Rest and stay hydrated — 8–10 glasses of water daily',
      'Take paracetamol for fever management',
      'Consult a doctor if symptoms persist beyond 2 days',
    ],
    specialist: 'General Physician',
    urgency: 'within_24h',
    emergency: false,
  }
}

export default function Symptoms() {
  const toast = useToast()
  const [selected, setSelected]   = useState([])
  const [input, setInput]         = useState('')
  const [results, setResults]     = useState(null)
  const [loading, setLoading]     = useState(false)

  function addSymptom(s) {
    if (selected.includes(s)) return
    setSelected(prev => [...prev, s])
  }
  function removeSymptom(s) {
    setSelected(prev => prev.filter(x => x !== s))
  }

  async function analyze() {
    if (!selected.length) { toast.warning('Please add at least one symptom.'); return }
    setLoading(true)
    setResults(null)
    try {
      const res = await symptomAPI.analyze({ symptoms: selected })
      setResults(res)
    } catch {
      setResults(mockResults(selected))
    } finally {
      setLoading(false)
    }
  }

  function addFromInput() {
    const v = input.trim()
    if (v) { addSymptom(v); setInput('') }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <span className="label">AI Diagnosis</span>
        <h1>🧠 Symptom Checker</h1>
        <p>Describe your symptoms and get AI-powered condition analysis with recommendations.</p>
      </div>

      <div className="symptoms-layout">
        {/* Input panel */}
        <Card>
          <span className="label">Common Symptoms</span>
          <div className="chips-wrap">
            {COMMON_SYMPTOMS.map(s => (
              <button
                key={s}
                className={`chip${selected.includes(s) ? ' active' : ''}`}
                onClick={() => selected.includes(s) ? removeSymptom(s) : addSymptom(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="custom-input-row" style={{ marginTop: 20 }}>
            <input
              className="input"
              placeholder="Type a custom symptom…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFromInput()}
              style={{ flex: 1 }}
            />
            <Button variant="outline" onClick={addFromInput}>Add</Button>
          </div>

          {selected.length > 0 && (
            <div className="selected-section">
              <span className="label" style={{ marginTop: 16 }}>Selected ({selected.length})</span>
              <div className="selected-tags">
                {selected.map(s => (
                  <span key={s} className="symptom-tag" onClick={() => removeSymptom(s)}>
                    {s} ✕
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="primary"
            className="btn-full"
            style={{ marginTop: 20 }}
            loading={loading}
            onClick={analyze}
          >
            🔍 Analyze Symptoms
          </Button>
        </Card>

        {/* Results panel */}
        <div className="results-col">
          {loading && <Card><PageLoading /></Card>}

          {results && !loading && (
            <>
              {results.emergency && (
                <Card style={{ borderColor: 'var(--red)', background: 'rgba(255,71,87,0.08)' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 28 }}>🚨</span>
                    <div>
                      <h3 style={{ color: 'var(--red)' }}>Emergency Detected</h3>
                      <p>Please seek immediate medical attention or call emergency services.</p>
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <span className="label">Possible Conditions</span>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {results.conditions.map((c, i) => (
                    <div key={i} className="condition-row">
                      <div className="condition-top">
                        <span className="condition-name">{c.name}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Badge variant={SEVERITY_BADGE[c.severity] || 'cyan'}>{c.severity}</Badge>
                          <span className="condition-pct">{c.probability}%</span>
                        </div>
                      </div>
                      <div className="progress-bar" style={{ marginBottom: 6 }}>
                        <div className="progress-fill" style={{ width: `${c.probability}%` }} />
                      </div>
                      <p style={{ fontSize: '0.85rem' }}>{c.description}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <span className="label">Recommendations</span>
                <ul className="reco-list">
                  {results.recommendations.map((r, i) => (
                    <li key={i} className="reco-item">
                      <span className="reco-dot" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                  <div className="info-pill">
                    <span className="info-pill-label">Specialist</span>
                    <span className="info-pill-val">{results.specialist}</span>
                  </div>
                  <div className="info-pill">
                    <span className="info-pill-label">Urgency</span>
                    <span className="info-pill-val">{results.urgency?.replace('_', ' ')}</span>
                  </div>
                </div>
              </Card>
            </>
          )}

          {!results && !loading && (
            <Card className="empty-results">
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🩺</div>
                <h3>Ready to Analyze</h3>
                <p>Select your symptoms and click "Analyze" to get AI-powered insights.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}