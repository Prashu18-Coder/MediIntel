/* ============================================
   MEDICORE AI — API Service (React version)
   ============================================ */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

async function request(method, path, body = null, isForm = false) {
  const token = localStorage.getItem('medicore_token')
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  // Do NOT set Content-Type for FormData — browser sets it with boundary automatically
  if (!isForm && body) headers['Content-Type'] = 'application/json'

  const opts = { method, headers }
  if (body) opts.body = isForm ? body : JSON.stringify(body)

  const url = `${BASE_URL}${path}`

  let res
  try {
    res = await fetch(url, opts)
  } catch (networkErr) {
    // True network failure — backend not running, refused connection, DNS fail
    console.error(`[API] Network error on ${method} ${url}:`, networkErr.message)
    throw {
      status:  0,
      message: `Cannot reach backend at ${BASE_URL}. Make sure the backend server is running on port 5000.`,
      data:    null,
    }
  }

  // Try to parse JSON — backend may return HTML on crashes
  let data
  try {
    data = await res.json()
  } catch (parseErr) {
    const text = await res.text().catch(() => '')
    console.error(`[API] Response from ${method} ${url} is not JSON (status ${res.status}):`, text.slice(0, 200))
    throw {
      status:  res.status,
      message: `Server returned an unexpected response (status ${res.status}). Check backend logs.`,
      data:    null,
    }
  }

  if (!res.ok) {
    console.error(`[API] ${method} ${url} failed (${res.status}):`, data)
    throw { status: res.status, message: data.message || 'Request failed', data }
  }

  return data
}

const get    = (path)       => request('GET',    path)
const post   = (path, body) => request('POST',   path, body)
const put    = (path, body) => request('PUT',    path, body)
const del    = (path)       => request('DELETE', path)
const upload = (path, form) => request('POST',   path, form, true)

export const authAPI = {
  googleAuth: (data) => post('/auth/google', data),
  register: (data) => post('/auth/register', data),
  login:    (data) => post('/auth/login', data),
  logout:   ()     => post('/auth/logout'),
  me:       ()     => get('/auth/me'),
}

export const symptomAPI = {
  analyze:     (data) => post('/symptoms/analyze', data),
  suggestions: (q)    => get(`/symptoms/suggestions?q=${encodeURIComponent(q)}`),
}

export const reportAPI = {
  upload:  (formData) => upload('/reports/upload', formData),
  getById: (id)       => get(`/reports/${id}`),
  list:    ()         => get('/reports'),
}

export const recordsAPI = {
  list:    ()         => get('/records'),
  getById: (id)       => get(`/records/${id}`),
  create:  (data)     => post('/records', data),
  update:  (id, data) => put(`/records/${id}`, data),
  delete:  (id)       => del(`/records/${id}`),
}

export const dashboardAPI = {
  healthScore: () => get('/dashboard/health-score'),
  risks:       () => get('/dashboard/risks'),
  timeline:    () => get('/dashboard/timeline'),
}

export const medicineAPI = {
  list:   ()          => get('/medicines'),
  add:    (data)      => post('/medicines', data),
  update: (id, data)  => put(`/medicines/${id}`, data),
  toggle: (id)        => put(`/medicines/${id}/toggle`),
  delete: (id)        => del(`/medicines/${id}`),
}

export const doctorAPI = {
  list:         (specialty) => get(`/doctors${specialty ? `?specialty=${specialty}` : ''}`),
  book:         (data)      => post('/appointments', data),
  appointments: ()          => get('/appointments'),
}

export const emergencyAPI = {
  trigger: (data) => post('/emergency/trigger', data),
  history: ()     => get('/emergency/history'),
}

export const bloodAPI = {
  search:   (bg, city) => get('/blood/search?blood_group=' + encodeURIComponent(bg) + '&city=' + encodeURIComponent(city)),
  register: (data)     => post('/blood/register', data),
}

export const mentalAPI = {
  chat:        (data) => post('/mental/chat', data),
  logMood:     (data) => post('/mental/mood', data),
  moodHistory: ()     => get('/mental/mood/history'),
}

export const scanAPI = {
  verify: (formData) => upload('/medicine-scan/verify', formData),
  list:   ()         => get('/medicine-scan'),
  getById:(id)       => get(`/medicine-scan/${id}`),
}
export const doctorPortalAPI = {
  getProfile:          ()                => get('/doctor-portal/profile'),
  updateProfile:       (data)            => put('/doctor-portal/profile', data),
  getRecommendations:  (specialty)       => get(`/doctor-portal/recommendations${specialty ? `?specialty=${encodeURIComponent(specialty)}` : ''}`),
  getMyPatients:       ()                => get('/doctor-portal/my-patients'),
  getPatientProfile:   (userId)          => get(`/doctor-portal/patient/${userId}`),
  getAppointments:     (status, date)    => get(`/doctor-portal/appointments${status && status!=='all' ? `?status=${status}` : ''}`),
  updateAppointment:   (id, data)        => put(`/doctor-portal/appointments/${id}`, data),
  reprioritize:        (case_id)         => post('/doctor-portal/prioritize', { case_id }),
  reviewCase:          (data)            => post('/doctor-portal/review-case', data),
  getAnalytics:        ()                => get('/doctor-portal/analytics'),
  getStats:            ()                => get('/doctor-portal/stats'),
}

export const patientCaseAPI = {
  submit:   (data) => post('/patient-cases', data),
  list:     ()     => get('/patient-cases'),
  getById:  (id)   => get(`/patient-cases/${id}`),
}


export const prescriptionAPI = {
  create:  (data)  => post('/prescriptions', data),
  list:    (patientId) => get(`/prescriptions${patientId ? `?patient_id=${patientId}` : ''}`),
  getById: (id)    => get(`/prescriptions/${id}`),
  update:  (id, data) => put(`/prescriptions/${id}`, data),
  delete:  (id)    => del(`/prescriptions/${id}`),
  mine:    ()      => get('/prescriptions/my'),
}