import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import './AppLayout.css'

export default function AppLayout() {
  const { isLoggedIn } = useAuth()
  if (!isLoggedIn) return <Navigate to="/login" replace />

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Outlet />
      </div>
    </div>
  )
}