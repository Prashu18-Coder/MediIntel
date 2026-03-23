import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('medicore_token'))
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('medicore_user')) } catch { return null }
  })
  const [role, setRole] = useState(() => localStorage.getItem('medicore_role') || 'patient')

  // userRole param is the source of truth — do NOT let usr.role override it
  // because the server defaults role to 'patient' for all users
  const login = useCallback((tok, usr, userRole) => {
    const r = userRole || 'patient'
    localStorage.setItem('medicore_token', tok)
    localStorage.setItem('medicore_role', r)
    if (usr) {
      // store user with the correct role
      localStorage.setItem('medicore_user', JSON.stringify({ ...usr, role: r }))
    }
    setToken(tok)
    setUser(usr ? { ...usr, role: r } : null)
    setRole(r)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('medicore_token')
    localStorage.removeItem('medicore_user')
    localStorage.removeItem('medicore_role')
    setToken(null)
    setUser(null)
    setRole('patient')
  }, [])

  const updateRole = useCallback((newRole) => {
    localStorage.setItem('medicore_role', newRole)
    setRole(newRole)
  }, [])

  const isLoggedIn = Boolean(token)
  const isDoctor   = role === 'doctor'
  const isPatient  = role === 'patient'

  return (
    <AuthContext.Provider value={{ token, user, role, login, logout, updateRole, isLoggedIn, isDoctor, isPatient }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)