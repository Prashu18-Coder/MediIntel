import { useState, useRef, useEffect } from 'react'
import { mentalAPI } from '../services/api'
import { Card, Button, Badge } from '../components/UI'
import './MentalHealth.css'

const MOODS = [
  { emoji: '😄', label: 'Great',   value: 5, color: '#00e5b0' },
  { emoji: '🙂', label: 'Good',    value: 4, color: '#00d4ff' },
  { emoji: '😐', label: 'Neutral', value: 3, color: '#ffb020' },
  { emoji: '😔', label: 'Low',     value: 2, color: '#ff7a87' },
  { emoji: '😰', label: 'Anxious', value: 1, color: '#ff4757' },
]

const BOT_REPLIES = {
  stress:  "I hear you — stress can feel really overwhelming. Let's try a quick breathing exercise. 🌬️",
  anxi:    "Anxiety is tough, but you're not alone. The 5-4-3-2-1 grounding technique can help. 🌿",
  sad:     "Thank you for sharing. Feeling sad is valid. Have you been able to talk to someone you trust? 💙",
  happy:   "That's wonderful! 😊 What has been making you feel good lately?",
  tired:   "Fatigue often signals your mind and body need more care. Are you getting 7–8 hours of sleep?",
  default: "Your feelings are completely valid. Would you like breathing exercises or mental health tips? 💙",
}

function getReply(msg) {
  const l = msg.toLowerCase()
  const key = Object.keys(BOT_REPLIES).find(k => l.includes(k))
  return BOT_REPLIES[key] || BOT_REPLIES.default
}

const BREATHE_STEPS = [
  { label: 'Inhale',  duration: 4000, color: '#00d4ff' },
  { label: 'Hold',    duration: 4000, color: '#7c5cfc' },
  { label: 'Exhale',  duration: 6000, color: '#00e5b0' },
]

export default function MentalHealth() {
  const [tab, setTab]           = useState('chat')
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm your mental wellness companion. How are you feeling today? 💙" },
  ])
  const [input, setInput]       = useState('')
  const [mood, setMood]         = useState(null)
  const [breatheStep, setBStep] = useState(null)
  const [breatheIdx, setBIdx]   = useState(0)
  const chatEndRef              = useRef(null)
  const breatheTimer            = useRef(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setTimeout(async () => {
      try {
        const res = await mentalAPI.chat({ message: text })
        setMessages(prev => [...prev, { role: 'bot', text: res.reply || getReply(text) }])
      } catch {
        setMessages(prev => [...prev, { role: 'bot', text: getReply(text) }])
      }
    }, 600)
  }

  async function logMood(m) {
    setMood(m)
    try { await mentalAPI.logMood({ mood: m.value, label: m.label }) } catch {}
    setMessages(prev => [
      ...prev,
      { role: 'user', text: `I'm feeling ${m.label} ${m.emoji}` },
      { role: 'bot', text: `I see you're feeling ${m.label.toLowerCase()}. ${m.value >= 4 ? "That's great! Keep up the positive energy. 🌟" : m.value <= 2 ? "I'm here for you. Let's talk about what's on your mind. 💙" : "That's okay. Would you like some mindfulness exercises? 🧘"}` },
    ])
  }

  function startBreathe() {
    setBStep(0); setBIdx(0)
    runBreathe(0)
  }
  function runBreathe(idx) {
    setBIdx(idx)
    const step = BREATHE_STEPS[idx % BREATHE_STEPS.length]
    setBStep(step)
    breatheTimer.current = setTimeout(() => runBreathe(idx + 1), step.duration)
  }
  function stopBreathe() {
    clearTimeout(breatheTimer.current)
    setBStep(null)
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <span className="label">Wellness Assistant</span>
        <h1>🧘 Mental Health</h1>
        <p>Mood tracking, stress detection, guided breathing, and wellness support.</p>
      </div>

      <div className="tab-bar" style={{ marginBottom: 20, maxWidth: 400 }}>
        {['chat', 'mood', 'breathe'].map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'chat' ? '💬 Chat' : t === 'mood' ? '😊 Mood' : '🌬️ Breathe'}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="chat-layout">
          <Card className="chat-card">
            <div className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.role}`}>
                  {m.role === 'bot' && <span className="bot-avatar">🤖</span>}
                  <span className="bubble-text">{m.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-row">
              <input
                className="input"
                placeholder="Share how you're feeling…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <Button variant="primary" onClick={sendMessage}>Send</Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'mood' && (
        <div>
          <Card style={{ maxWidth: 520 }}>
            <span className="label">How are you feeling right now?</span>
            <div className="mood-grid">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  className={`mood-btn${mood?.value === m.value ? ' selected' : ''}`}
                  style={{ '--mood-color': m.color }}
                  onClick={() => logMood(m)}
                >
                  <span className="mood-emoji">{m.emoji}</span>
                  <span className="mood-label">{m.label}</span>
                </button>
              ))}
            </div>
            {mood && (
              <div className="mood-logged">
                <span style={{ fontSize: 24 }}>{mood.emoji}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: mood.color }}>
                    Feeling {mood.label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mood logged successfully</div>
                </div>
                <Badge variant="green">Saved</Badge>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'breathe' && (
        <div style={{ maxWidth: 480 }}>
          <Card>
            <span className="label">Guided Breathing</span>
            <p style={{ marginTop: 8, marginBottom: 24 }}>
              Follow the breathing exercise to reduce stress and anxiety. The 4-4-6 technique is clinically proven to activate the relaxation response.
            </p>
            <div className="breathe-circle-wrap">
              <div
                className={`breathe-circle${breatheStep ? ' active' : ''}`}
                style={{ '--breathe-color': breatheStep?.color || 'var(--cyan)' }}
              >
                <span className="breathe-label">{breatheStep?.label || 'Ready'}</span>
                {breatheStep && (
                  <span className="breathe-duration">{breatheStep.duration / 1000}s</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
              {!breatheStep
                ? <Button variant="primary" onClick={startBreathe}>▶ Start Exercise</Button>
                : <Button variant="outline" onClick={stopBreathe}>■ Stop</Button>
              }
            </div>
            <div className="breathe-steps">
              {BREATHE_STEPS.map((s, i) => (
                <div key={i} className={`breathe-step${breatheStep?.label === s.label ? ' active' : ''}`}>
                  <span className="step-dot" style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {s.duration / 1000}s
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
