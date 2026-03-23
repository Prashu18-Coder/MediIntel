import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

let id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'info') => {
    const tid = ++id
    setToasts(t => [...t, { id: tid, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== tid)), 3500)
  }, [])

  const toast = {
    success: (m) => show(m, 'success'),
    error:   (m) => show(m, 'error'),
    info:    (m) => show(m, 'info'),
    warning: (m) => show(m, 'warning'),
  }

  const ICONS   = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' }
  const BORDERS = {
    success: 'rgba(0,229,176,0.3)',
    error:   'rgba(255,71,87,0.3)',
    info:    'rgba(0,212,255,0.25)',
    warning: 'rgba(255,176,32,0.3)',
  }
  const COLORS = {
    success: 'rgba(0,229,176,0.12)',
    error:   'rgba(255,71,87,0.12)',
    info:    'rgba(0,212,255,0.1)',
    warning: 'rgba(255,176,32,0.12)',
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: '#0f1a2e',
            border: `1px solid ${BORDERS[t.type]}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.875rem', color: '#e8f0fe',
            fontFamily: '"DM Sans", sans-serif',
            backdropFilter: 'blur(10px)',
            animation: 'slideInRight 0.3s ease both',
            minWidth: 260, maxWidth: 360,
          }}>
            <span style={{
              background: COLORS[t.type], borderRadius: '50%',
              width: 22, height: 22, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0,
            }}>{ICONS[t.type]}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
