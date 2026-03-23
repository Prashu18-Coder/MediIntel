import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider }  from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import AppLayout from './components/AppLayout'

import Home         from './pages/Home'
import Login        from './pages/Login'
import Dashboard    from './pages/Dashboard'
import DoctorDashboard    from './pages/Doctordashboard'
import DoctorPatients     from './pages/Doctorpatients'
import DoctorAppointments from './pages/Doctorappointments'
import DoctorAnalytics    from './pages/Doctoranalytics'
import DoctorPrescriptions from './pages/Doctorprescriptions'
import Symptoms     from './pages/Symptoms'
import Reports      from './pages/Reports'
import Medicines    from './pages/Medicines'
import MentalHealth from './pages/MentalHealth'
import Emergency    from './pages/Emergency'
import BloodDonor   from './pages/BloodDonor'
import MedicineScan from './pages/MedicineScan'

const toastStyle = {
  style: {
    background: '#131e33', color: '#e8f0fe',
    border: '1px solid rgba(0,212,255,0.2)', borderRadius: '12px',
    fontFamily: 'DM Sans, sans-serif', fontSize: '0.875rem',
    padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  success: { iconTheme: { primary: '#00e5b0', secondary: '#131e33' }, style: { borderColor: 'rgba(0,229,176,0.3)' } },
  error:   { iconTheme: { primary: '#ff4757', secondary: '#131e33' }, style: { borderColor: 'rgba(255,71,87,0.3)' } },
  custom:  { style: { borderColor: 'rgba(0,212,255,0.35)' } },
}

// Placeholder pages for doctor-only routes (can be expanded later)
function ComingSoon({ title }) {
  return (
    <div className="page-content">
      <div className="page-header">
        <h1>{title}</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
          This section is coming soon. Dashboard overview is available now.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Toaster position="top-right" toastOptions={toastStyle} />
        <Routes>
          <Route path="/"      element={<Home />}  />
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            {/* Shared / Patient routes */}
            <Route path="/dashboard"     element={<Dashboard />}    />
            <Route path="/symptoms"      element={<Symptoms />}     />
            <Route path="/reports"       element={<Reports />}      />
            <Route path="/medicines"     element={<Medicines />}    />
            <Route path="/mental-health" element={<MentalHealth />} />
            <Route path="/emergency"     element={<Emergency />}    />
            <Route path="/blood-donor"   element={<BloodDonor />}   />
            <Route path="/medicine-scan" element={<MedicineScan />} />
            {/* Doctor routes */}
            <Route path="/doctor/dashboard"      element={<DoctorDashboard />}      />
            <Route path="/doctor/patients"       element={<DoctorPatients />}       />
            <Route path="/doctor/appointments"   element={<DoctorAppointments />}   />
            <Route path="/doctor/prescriptions"  element={<DoctorPrescriptions />}  />
            <Route path="/doctor/reports"        element={<Reports />}              />
            <Route path="/doctor/analytics"      element={<DoctorAnalytics />}      />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}