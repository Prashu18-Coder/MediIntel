import { useState } from 'react'
import { bloodAPI } from '../services/api'
import { Card, Button, Badge } from '../components/UI'
import { useToast } from '../context/ToastContext'
import './BloodDonor.css'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function BloodDonor() {
  const toast = useToast()
  const [tab, setTab]           = useState('search')
  const [bg, setBg]             = useState('O+')
  const [city, setCity]         = useState('')
  const [donors, setDonors]     = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading]   = useState(false)

  const [rName, setRName]   = useState('')
  const [rBg, setRBg]       = useState('O+')
  const [rCity, setRCity]   = useState('')
  const [rPhone, setRPhone] = useState('')
  const [rAge, setRAge]     = useState('')
  const [registered, setReg] = useState(false)
  const [regLoading, setRegLoading] = useState(false)

  async function search() {
    if (!city.trim()) { toast.warning('Please enter a city.'); return }
    setLoading(true)
    try {
      const res = await bloodAPI.search(bg, city)
      setDonors(res.donors || [])
    } catch (err) {
      console.error('[BloodDonor] Search error:', err)
      toast.error((err && err.message) || 'Search failed. Check backend is running.')
      setDonors([])
    }
    setSearched(true)
    setLoading(false)
  }

  async function register() {
    if (!rName.trim())  { toast.warning('Full name is required.'); return }
    if (!rCity.trim())  { toast.warning('City is required.'); return }
    if (!rPhone.trim()) { toast.warning('Phone number is required.'); return }
    setRegLoading(true)
    try {
      const res = await bloodAPI.register({
        name:        rName.trim(),
        blood_group: rBg,
        city:        rCity.trim(),
        phone:       rPhone.trim(),
        age:         rAge,
      })
      console.log('[BloodDonor] Registered:', res)
      setReg(true)
      toast.success('You are now registered as a blood donor!')
    } catch (err) {
      console.error('[BloodDonor] Register error:', err)
      const msg = (err && err.message) || (err && err.data && err.data.message) || 'Registration failed.'
      toast.error(msg)
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <span className="label">Donor Network</span>
        <h1>Blood Donor Match</h1>
        <p>Smart system connecting patients with compatible blood donors in real time.</p>
      </div>

      <div className="tab-bar" style={{ marginBottom: 24, maxWidth: 340 }}>
        <button className={'tab-btn' + (tab === 'search' ? ' active' : '')} onClick={() => setTab('search')}>Find Donor</button>
        <button className={'tab-btn' + (tab === 'register' ? ' active' : '')} onClick={() => setTab('register')}>Be a Donor</button>
      </div>

      {tab === 'search' && (
        <div className="blood-layout">
          <Card>
            <span className="label">Search Criteria</span>
            <div style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>BLOOD GROUP NEEDED</label>
                <div className="bg-grid">
                  {BLOOD_GROUPS.map(g => (
                    <button
                      key={g}
                      className={'bg-btn' + (bg === g ? ' selected' : '')}
                      onClick={() => setBg(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>CITY</label>
                <input
                  className="input"
                  placeholder="e.g. Hyderabad"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                />
              </div>
              <Button variant="primary" className="btn-full" loading={loading} onClick={search}>
                Search Donors
              </Button>
            </div>
          </Card>

          <div>
            {!searched && (
              <Card className="empty-results">
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ fontSize: 52, marginBottom: 16 }}>🩸</div>
                  <h3>Find a Donor</h3>
                  <p>Search by blood group and city to find compatible donors near you.</p>
                </div>
              </Card>
            )}
            {searched && donors.length === 0 && (
              <Card>
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <p>No donors found for <strong>{bg}</strong> in <strong>{city}</strong>.</p>
                </div>
              </Card>
            )}
            {donors.length > 0 && (
              <div className="donors-list">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span className="label" style={{ marginBottom: 0 }}>{donors.length} Donor{donors.length !== 1 ? 's' : ''} Found</span>
                  <Badge variant="cyan">{bg} · {city}</Badge>
                </div>
                {donors.map((d, i) => (
                  <Card key={d._id || d.id || i} className="donor-card">
                    <div className="donor-top">
                      <div className="donor-avatar">{d.blood || d.blood_group}</div>
                      <div className="donor-info">
                        <div className="donor-name">{d.name}</div>
                        <div className="donor-meta">📍 {d.city}</div>
                      </div>
                      <Badge variant={d.available ? 'green' : 'amber'}>
                        {d.available ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                    <div className="donor-details">
                      <span>📞 {d.phone}</span>
                    </div>
                    {d.available && (
                      <Button variant="outline" size="sm" onClick={() => toast.info('Contacting ' + d.name + '...')}>
                        Contact Donor
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'register' && (
        <div style={{ maxWidth: 540 }}>
          {registered ? (
            <Card style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>❤️</div>
              <h2 style={{ color: 'var(--red)' }}>Thank You!</h2>
              <p style={{ marginTop: 12 }}>You are now registered as a blood donor.</p>
              <Button variant="outline" style={{ marginTop: 24 }} onClick={() => { setReg(false); setRName(''); setRCity(''); setRPhone(''); setRAge('') }}>
                Update Details
              </Button>
            </Card>
          ) : (
            <Card>
              <span className="label">Register as Donor</span>
              <p style={{ marginTop: 8, marginBottom: 20 }}>Your donation could save a life.</p>
              <div className="form-group">
                <label>FULL NAME *</label>
                <input className="input" placeholder="Your name" value={rName} onChange={e => setRName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>BLOOD GROUP *</label>
                <div className="bg-grid">
                  {BLOOD_GROUPS.map(g => (
                    <button key={g} className={'bg-btn' + (rBg === g ? ' selected' : '')} onClick={() => setRBg(g)}>{g}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>CITY *</label>
                  <input className="input" placeholder="Your city" value={rCity} onChange={e => setRCity(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>AGE</label>
                  <input className="input" type="number" placeholder="e.g. 28" value={rAge} onChange={e => setRAge(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>PHONE *</label>
                <input className="input" placeholder="+91 00000 00000" value={rPhone} onChange={e => setRPhone(e.target.value)} />
              </div>
              <Button variant="primary" className="btn-full" loading={regLoading} onClick={register}>
                Register as Donor
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}