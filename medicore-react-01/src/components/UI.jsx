import './UI.css'

export function Card({ children, className = '', glow = false, style, onClick }) {
  return (
    <div
      className={`card${glow ? ' glow' : ''}${className ? ' ' + className : ''}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function Button({
  children, variant = 'primary', size = '',
  disabled = false, loading = false,
  onClick, type = 'button', className = '', style,
}) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', className].filter(Boolean).join(' ')
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      onClick={onClick}
      style={style}
    >
      {loading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8 }} />}
      {children}
    </button>
  )
}

export function Badge({ children, variant = 'cyan', style }) {
  return <span className={`badge badge-${variant}`} style={style}>{children}</span>
}

export function Input({ id, label, type = 'text', placeholder, value, onChange, autoComplete }) {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type={type}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
      />
    </div>
  )
}

export function Select({ id, label, value, onChange, children }) {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} className="input" value={value} onChange={onChange}>
        {children}
      </select>
    </div>
  )
}

export function Alert({ message, type = 'error', show = false }) {
  if (!show || !message) return null
  return <div className={`alert alert-${type} show`}>{message}</div>
}

export function PulseRing() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span className="pulse-dot" />
    </span>
  )
}

export function PageLoading() {
  return (
    <div className="page-loading">
      <span className="spinner" />
      <span>Loading…</span>
    </div>
  )
}

export function SectionHeader({ label, title, subtitle }) {
  return (
    <div className="section-header">
      {label && <span className="label">{label}</span>}
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}
