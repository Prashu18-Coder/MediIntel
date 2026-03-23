import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { authAPI } from '../services/api'
import { Button, Alert } from '../components/UI'
import './Login.css'

export default function Login() {
  const { isLoggedIn, login, role: savedRole } = useAuth()
  const toast    = useToast()
  const navigate = useNavigate()

  const [mode, setMode]       = useState('login')
  const [selectedRole, setSelectedRole] = useState('patient')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  // Already logged in — redirect to correct dashboard
  if (isLoggedIn) {
    return <Navigate to={savedRole === 'doctor' ? '/doctor/dashboard' : '/dashboard'} replace />
  }

  async function handleSubmit(e) {
    e?.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    setLoading(true)
    try {
      let res
      if (mode === 'login') {
        res = await authAPI.login({ email, password })
      } else {
        const full_name = name.trim() || email.split('@')[0]
        res = await authAPI.register({ full_name, email, password, role: selectedRole })
      }

      if (res.access_token || res.token) {
        // Always use the role the user selected — never trust server default
        login(res.access_token || res.token, res.user, selectedRole)
        toast.success(`Welcome to MediIntel${selectedRole === 'doctor' ? ', Doctor' : ''}!`)
        navigate(selectedRole === 'doctor' ? '/doctor/dashboard' : '/dashboard', { replace: true })
      } else {
        throw new Error('No token received')
      }
    } catch (err) {
      if (err.status === 0 || err.status >= 500) {
        // Demo / offline mode
        const usr = { email, full_name: name || email.split('@')[0], id: 'demo', role: selectedRole }
        login('demo_token_' + Date.now(), usr, selectedRole)
        toast.info('Demo mode — backend offline')
        navigate(selectedRole === 'doctor' ? '/doctor/dashboard' : '/dashboard', { replace: true })
      } else {
        setError(err.message || 'Login failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <div className="login-page grid-bg">
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />

      <div className="login-box">
        <div className="login-brand">
          <span className="login-logo">⚕️</span>
          <div>
            <div className="login-brand-name">Medi<span>Intel</span></div>
            <div className="login-brand-sub">Intelligent Health Platform</div>
          </div>
        </div>

        {/* Role selector */}
        <div className="login-role-selector">
          <button
            className={'login-role-btn' + (selectedRole === 'patient' ? ' active' : '')}
            onClick={() => setSelectedRole('patient')}
            type="button"
          >
            <span className="login-role-icon">🧑‍⚕️</span>
            <span className="login-role-label">Patient</span>
            <span className="login-role-desc">Personal health management</span>
          </button>
          <button
            className={'login-role-btn' + (selectedRole === 'doctor' ? ' active' : '')}
            onClick={() => setSelectedRole('doctor')}
            type="button"
          >
            <span className="login-role-icon">👨‍⚕️</span>
            <span className="login-role-label">Doctor</span>
            <span className="login-role-desc">Clinical dashboard & patients</span>
          </button>
        </div>

        <div className="tab-bar" style={{ marginBottom: 24 }}>
          <button className={`tab-btn${mode === 'login' ? ' active' : ''}`} onClick={() => { setMode('login'); setError('') }}>
            Sign In
          </button>
          <button className={`tab-btn${mode === 'register' ? ' active' : ''}`} onClick={() => { setMode('register'); setError('') }}>
            Create Account
          </button>
        </div>

        <Alert message={error} type="error" show={Boolean(error)} />

        {mode === 'register' && (
          <div className="form-group">
            <label htmlFor="name-input">FULL NAME</label>
            <input id="name-input" type="text" className="input"
              placeholder={selectedRole === 'doctor' ? 'Dr. Your Name' : 'Your full name'}
              value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey} />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email-input">EMAIL</label>
          <input id="email-input" type="email" className="input"
            placeholder="you@example.com" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={onKey} autoComplete="email" />
        </div>

        <div className="form-group">
          <label htmlFor="pass-input">PASSWORD</label>
          <input id="pass-input" type="password" className="input"
            placeholder="••••••••" value={password}
            onChange={e => setPass(e.target.value)} onKeyDown={onKey}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </div>

        <Button variant="primary" className="btn-full" loading={loading}
          onClick={handleSubmit} style={{ marginTop: 8 }}>
          {mode === 'login'
            ? `→ Sign In as ${selectedRole === 'doctor' ? 'Doctor' : 'Patient'}`
            : `→ Create ${selectedRole === 'doctor' ? 'Doctor' : 'Patient'} Account`}
        </Button>

        <p className="login-disclaimer">
          ⚕️ For educational purposes only. Always consult a licensed physician.
        </p>
      </div>
    </div>
  )
}