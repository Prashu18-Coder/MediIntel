import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PatientDashboard from './Patientdashboard'

// /dashboard always shows PatientDashboard
// Doctors are sent to /doctor/dashboard by Login — but if a doctor somehow
// lands here, redirect them to the right place
export default function Dashboard() {
  const { isDoctor } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isDoctor) navigate('/doctor/dashboard', { replace: true })
  }, [isDoctor, navigate])

  if (isDoctor) return null
  return <PatientDashboard />
}