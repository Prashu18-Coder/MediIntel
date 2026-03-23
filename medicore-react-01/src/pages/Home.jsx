import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Badge } from '../components/UI'
import './Home.css'

const FEATURES = [
  { icon: '🧠', title: 'AI Symptom Checker',  desc: 'Describe symptoms and get instant AI-powered diagnosis with condition probabilities.', to: '/symptoms',       badge: 'ML Powered' },
  { icon: '🧬', title: 'Report Analyzer',      desc: 'Upload blood tests or scans. AI extracts values, flags abnormalities, and explains results.', to: '/reports',         badge: 'OCR + NLP'  },
  { icon: '📊', title: 'Health Dashboard',     desc: 'Real-time health score, risk prediction, vitals tracking, and personalized advice.', to: '/dashboard',       badge: 'Analytics'  },
  { icon: '💊', title: 'Medicine Reminders',   desc: 'Smart medication tracker with dose alerts and caregiver notifications.', to: '/medicines',       badge: 'Smart Alert' },
  { icon: '🧘', title: 'Mental Health AI',     desc: 'Mood tracking, stress detection, guided breathing, and wellness support.', to: '/mental-health',   badge: 'AI Chat'    },
  { icon: '🚨', title: 'Emergency Alerts',     desc: 'One-tap SOS with GPS location sharing to family and nearby hospitals.', to: '/emergency',       badge: 'GPS'        },
  { icon: '🩸', title: 'Blood Donor Match',    desc: 'Smart system connecting patients with compatible blood donors in real time.', to: '/blood-donor',     badge: 'Matching'   },
  { icon: '💊', title: 'Fake Medicine Detect', desc: 'Scan packaging — AI verifies authenticity and detects counterfeit drugs.', to: '/medicine-scan',   badge: 'Scan AI'    },
]

const STATS = [
  { value: '10+',    label: 'AI-Powered Features'  },
  { value: '99.2%',  label: 'Diagnostic Accuracy'  },
  { value: '50K+',   label: 'Patients Served'      },
  { value: '256-bit',label: 'Data Encryption'      },
]

export default function Home() {
  const { isLoggedIn } = useAuth()
  if (isLoggedIn) return <Navigate to="/dashboard" replace />

  return (
    <div className="home grid-bg">
      {/* Nav */}
      <nav className="public-nav">
        <div className="container">
          <span className="nav-brand">
            <span>⚕️</span> Medi<span>Intel</span> AI
          </span>
          <div className="nav-actions">
            <div className="ai-status-badge">
              <span className="pulse-dot" />
              Systems Online
            </div>
            <Link to="/login" className="btn btn-outline">Login</Link>
            <Link to="/login" className="btn btn-primary">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />
        <div className="container" style={{ position: 'relative' }}>
          <div className="animate-up">
            <Badge variant="cyan">
              <span className="pulse-dot" style={{ width: 6, height: 6 }} />
              AI-Powered Healthcare
            </Badge>
          </div>
          <h1 className="hero-title animate-up delay-1">
            Your Health,<br />
            <span className="gradient-text">Intelligently Managed</span>
          </h1>
          <p className="hero-subtitle animate-up delay-2">
            MediCore AI combines machine learning, NLP, and medical intelligence to deliver accurate diagnoses,
            real-time health tracking, and smart care recommendations.
          </p>
          <div className="hero-actions animate-up delay-3">
            <Link to="/login" className="btn btn-primary btn-lg">🔍 Check Symptoms</Link>
            <Link to="/login" className="btn btn-outline btn-lg">View Dashboard</Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="container">
          <div className="grid-4">
            {STATS.map((s, i) => (
              <div key={s.label} className={`card stat-card animate-up delay-${i + 1}`}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="container">
          <div className="features-header">
            <span className="label">Platform Modules</span>
            <h2>Everything You Need for <span className="gradient-text">Smart Healthcare</span></h2>
          </div>
          <div className="grid-auto">
            {FEATURES.map(f => (
              <Link key={f.to} to="/login" className="card feature-card">
                <div className="feature-meta">
                  <span className="feature-icon">{f.icon}</span>
                  <Badge variant="cyan">{f.badge}</Badge>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className="feature-link">Open module →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <div className="card cta-card">
            <h2>Start Your Health Journey Today</h2>
            <p>Join thousands managing their health smarter with AI-powered insights, real-time monitoring, and expert consultations.</p>
            <Link to="/login" className="btn btn-primary btn-lg" style={{ marginTop: 32 }}>
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="container">
          <span className="footer-brand">⚕️ MediCore AI</span>
          <span className="footer-legal">© 2025 MediCore AI. For informational purposes only. Always consult a licensed physician.</span>
        </div>
      </footer>
    </div>
  )
}
