import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import './Sidebar.css'

const PATIENT_NAV = [
  { to: '/dashboard',      icon: '📊', label: 'Dashboard'     },
  { to: '/symptoms',       icon: '🧠', label: 'Symptoms'      },
  { to: '/reports',        icon: '🧬', label: 'Reports'       },
  { to: '/medicines',      icon: '💊', label: 'Medicines'     },
  { to: '/mental-health',  icon: '🧘', label: 'Mental Health' },
  { to: '/emergency',      icon: '🚨', label: 'Emergency'     },
  { to: '/blood-donor',    icon: '🩸', label: 'Blood Donor'   },
  { to: '/medicine-scan',  icon: '🔍', label: 'Medicine Scan' },
]

const DOCTOR_NAV = [
  { to: '/doctor/dashboard',       icon: '🏥', label: 'Overview'       },
  { to: '/doctor/patients',        icon: '👥', label: 'My Patients'    },
  { to: '/doctor/appointments',    icon: '📅', label: 'Appointments'   },
  { to: '/doctor/prescriptions',   icon: '💊', label: 'Prescriptions'  },
  { to: '/doctor/reports',         icon: '🧬', label: 'Reports'        },
  { to: '/doctor/analytics',       icon: '📈', label: 'Analytics'      },
  { to: '/symptoms',               icon: '🧠', label: 'Symptom AI'     },
]

export default function Sidebar() {
  const { logout, user, role } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const isDoctor = role === 'doctor'
  const NAV = isDoctor ? DOCTOR_NAV : PATIENT_NAV

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${isDoctor ? ' sidebar--doctor' : ''}`} id="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">⚕️</span>
        <span className="logo-text">Medi <span>Intel</span></span>
      </div>

      {/* Role badge */}
      <div className="sidebar-role-badge">
        <span className="role-badge-dot" style={{ background: isDoctor ? '#7c5cfc' : '#00d4ff' }} />
        <span className="role-badge-text">{isDoctor ? 'Doctor Portal' : 'Patient Portal'}</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="user-avatar-wrap" style={{ background: isDoctor ? 'rgba(124,92,252,0.15)' : 'rgba(0,212,255,0.12)' }}>
              <span className="user-avatar">{isDoctor ? '👨‍⚕️' : '👤'}</span>
            </div>
            <div className="user-info">
              <span className="user-name">{user.full_name || user.email?.split('@')[0]}</span>
              <span className="user-role-tag" style={{ color: isDoctor ? '#7c5cfc' : '#00d4ff' }}>
                {isDoctor ? 'Doctor' : 'Patient'}
              </span>
            </div>
          </div>
        )}
        <button className="btn-logout" onClick={logout} title="Logout">
          <span>⏻</span>
          <span className="nav-label">Logout</span>
        </button>
      </div>

      <button className="sidebar-toggle" id="sidebar-toggle"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? '▶' : '◀'}
      </button>
    </aside>
  )
}