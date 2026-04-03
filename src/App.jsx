import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './index.css'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('welcome')
  const [userRole, setUserRole] = useState('none')
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [loginId, setLoginId] = useState('')

  const [touristForm, setTouristForm] = useState({ tourist_id: '', name: '', phone: '', email: '', nationality: '' })
  const [touristMsg, setTouristMsg] = useState({ type: '', text: '' })
  const [dashboardData, setDashboardData] = useState(null)
  const [loadMsg, setLoadMsg] = useState('')

  const handleLogin = (role) => {
    if (!loginId) return alert('Please enter ID')
    setUserRole(role)
    setLoggedInUser(loginId)
    setActiveTab('dashboard')
  }

  const handleLogout = () => {
    setUserRole('none')
    setLoggedInUser(null)
    setLoginId('')
    setActiveTab('welcome')
  }

  const [travelStep, setTravelStep] = useState('districts')
  const [viewLoading, setViewLoading] = useState(false)
  const [dataList, setDataList] = useState([])
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [selectedDestination, setSelectedDestination] = useState(null)
  const [selectedHotel, setSelectedHotel] = useState(null)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [currentBooking, setCurrentBooking] = useState(null)

  const [bookingForm, setBookingForm] = useState({ 
    booking_id: '', 
    tourist_id: '', 
    travel_date: '',
    booking_date: new Date().toISOString().split('T')[0]
  })
  const [bookingMsg, setBookingMsg] = useState({ type: '', text: '' })
  const [paymentMsg, setPaymentMsg] = useState({ type: '', text: '' })

  const handleTouristChange = (e) => setTouristForm({ ...touristForm, [e.target.name]: e.target.value })
  const handleRegisterTourist = async (e) => {
    e.preventDefault(); setTouristMsg({ type: '', text: '' })
    try {
      const { error } = await supabase.from('tourist').insert([touristForm])
      if (error) throw error
      setTouristMsg({ type: 'success', text: 'Tourist Registered!' })
      setTouristForm({ tourist_id: '', name: '', phone: '', email: '', nationality: '' })
    } catch (err) { setTouristMsg({ type: 'error', text: err.message }) }
  }

  const fetchTouristDashboard = async () => {
    setLoadMsg('Loading your adventures...'); try {
      // Using literal foreign key names (package_id, destination_id) as keys
      const { data, error } = await supabase
        .from('booking')
        .select(`
           *,
           package_id(
             *,
             destination_id(*)
           )
        `)
        .ilike('tourist_id', loggedInUser)
      
      if (error) throw error
      setDashboardData(data || [])
      setLoadMsg('')
    } catch (err) { setLoadMsg('Error: ' + err.message) }
  }

  const fetchDistrictOfficerDashboard = async () => {
     setLoadMsg('Loading Stats...'); try {
        const { data: dist, error: distErr } = await supabase.from('district').select('*').ilike('district_code', loggedInUser).single()
        if (distErr) throw distErr
        const { data: count, error: countErr } = await supabase.rpc('get_total_destinations', { dist_code: dist.district_code })
        if (countErr) throw countErr
        const { data: rev, error: rpcErr } = await supabase.rpc('get_avg_revenue', { dist_code: dist.district_code })
        if (rpcErr) throw rpcErr
        setDashboardData({ ...dist, dest_count: count, avg_revenue: rev })
        setLoadMsg('')
     } catch (err) { setLoadMsg('Error: ' + err.message) }
  }

  const fetchHotelManagerDashboard = async () => {
     setLoadMsg('Loading Packages...'); try {
        const { data, error } = await supabase.from('package').select('*').ilike('hotel_id', loggedInUser)
        if (error) throw error
        const detailedPkgs = await Promise.all((data || []).map(async (pkg) => {
           const { count } = await supabase.from('booking').select('*', { count: 'exact', head: true }).eq('package_id', pkg.package_id)
           return { ...pkg, booking_count: count || 0 }
        }))
        setDashboardData(detailedPkgs)
        setLoadMsg('')
     } catch (err) { setLoadMsg('Error: ' + err.message) }
  }

  useEffect(() => {
    if (activeTab === 'dashboard' && loggedInUser) {
      if (userRole === 'tourist') fetchTouristDashboard()
      else if (userRole === 'district_officer') fetchDistrictOfficerDashboard()
      else if (userRole === 'hotel_manager') fetchHotelManagerDashboard()
    }
    if (activeTab === 'plan') {
       if (travelStep === 'districts') fetchDistricts()
       else if (travelStep === 'destinations' && selectedDistrict) fetchDestinations()
       else if (travelStep === 'hotels' && selectedDestination) fetchHotels()
       else if (travelStep === 'packages' && selectedHotel) fetchPackages()
    }
  }, [travelStep, activeTab, userRole, loggedInUser])

  const navigateToStep = (s) => { setTravelStep(s); if (s === 'districts') setDataList([]); }
  const handleGoBack = () => {
    if (travelStep === 'destinations') navigateToStep('districts')
    else if (travelStep === 'hotels') navigateToStep('destinations')
    else if (travelStep === 'packages') navigateToStep('hotels')
    else if (travelStep === 'booking') navigateToStep('packages')
  }

  const fetchDistricts = async () => { setViewLoading(true); try { const { data } = await supabase.from('district').select('*'); setDataList(data || []) } finally { setViewLoading(false) } }
  const fetchDestinations = async () => { 
    setViewLoading(true); try { 
      const code = selectedDistrict.district_code || selectedDistrict.id;
      const { data } = await supabase.from('destination').select('*').eq('district_code', code); 
      setDataList(data || []) 
    } finally { setViewLoading(false) } 
  }
  const fetchHotels = async () => { 
    setViewLoading(true); try { 
      const destId = selectedDestination.destination_id || selectedDestination.id;
      const { data } = await supabase.from('hotel').select('*').eq('destination_id', destId); 
      setDataList(data || []) 
    } finally { setViewLoading(false) } 
  }
  const fetchPackages = async () => { 
    setViewLoading(true); try { 
      const hId = selectedHotel.hotel_id || selectedHotel.id;
      const { data } = await supabase.from('package').select('*').eq('hotel_id', hId); 
      setDataList(data || []) 
    } finally { setViewLoading(false) } 
  }

  const handleBookingSubmit = async (e) => {
    e.preventDefault(); try {
       const payload = { 
         booking_id: bookingForm.booking_id, 
         tourist_id: bookingForm.tourist_id, 
         package_id: selectedPackage.package_id || selectedPackage.id, 
         booking_date: bookingForm.booking_date, 
         travel_date: bookingForm.travel_date 
       }
       const { error } = await supabase.from('booking').insert([payload])
       if (error) throw error
       setCurrentBooking(payload)
       setTravelStep('payment')
    } catch (err) { setBookingMsg({ type: 'error', text: err.message }) }
  }

  const handlePaymentSubmit = async () => {
    try {
      const payload = { 
        payment_id: 'P'+Math.random().toString(36).substr(2,4).toUpperCase(), 
        booking_id: currentBooking.booking_id, 
        payment_amount: selectedPackage.total_cost || 0 
      }
      const { error } = await supabase.from('payment').insert([payload])
      if (error) throw error
      setTravelStep('success')
    } catch (err) { setPaymentMsg({ type: 'error', text: err.message }) }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><h1>Kerala Tourism</h1></div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${activeTab === 'welcome' ? 'active' : ''}`} onClick={() => setActiveTab('welcome')}>Welcome</button>
          <button className={`nav-btn ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}>Register</button>
          <button className={`nav-btn ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>Plan Trip</button>
          <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        </nav>
      </aside>

      <main className="main-content">
        {activeTab === 'welcome' && (
          <div className="welcome-card tab-content-reveal">
            <h2 className="welcome-title">Emerald Valleys</h2>
            <p className="welcome-narrative">Experience God's Own Country in its purest form.</p>
            <button className="btn" style={{ width: 'auto', marginTop: '2rem' }} onClick={() => setActiveTab('plan')}>Explore Kerala &rarr;</button>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="card tab-content-reveal">
            <h2 className="main-tab-title">Tourist Registration</h2>
            {touristMsg.text && <div className={`msg ${touristMsg.type}`}>{touristMsg.text}</div>}
            <form onSubmit={handleRegisterTourist}>
              <div className="form-group"><label>Tourist ID (Login)</label><input type="text" name="tourist_id" className="form-input" value={touristForm.tourist_id} onChange={handleTouristChange} required /></div>
              <div className="form-group"><label>Full Name</label><input type="text" name="name" className="form-input" value={touristForm.name} onChange={handleTouristChange} required /></div>
              <div className="form-group"><label>Phone Number</label><input type="text" name="phone" className="form-input" value={touristForm.phone} onChange={handleTouristChange} /></div>
              <div className="form-group"><label>Email ID</label><input type="email" name="email" className="form-input" value={touristForm.email} onChange={handleTouristChange} /></div>
              <div className="form-group"><label>Nationality</label><input type="text" name="nationality" className="form-input" value={touristForm.nationality} onChange={handleTouristChange} /></div>
              <button type="submit" className="btn">Sign Up & Plan</button>
            </form>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="card tab-content-reveal">
            <div className="flex-between"><h2 className="main-tab-title">{travelStep.charAt(0).toUpperCase() + travelStep.slice(1)} Explorer</h2>{travelStep !== 'districts' && <button className="btn btn-secondary btn-small" onClick={handleGoBack}>Back</button>}</div>
            {viewLoading && <p>Loading nature's bounty...</p>}
            {!viewLoading && ['districts', 'destinations', 'hotels', 'packages'].includes(travelStep) && (
              <div className="grid-cards">
                {dataList.map((item, idx) => (
                  <div key={idx} className="data-card clickable" onClick={() => {
                     if (travelStep === 'districts') { setSelectedDistrict(item); setTravelStep('destinations'); }
                     else if (travelStep === 'destinations') { setSelectedDestination(item); setTravelStep('hotels'); }
                     else if (travelStep === 'hotels') { setSelectedHotel(item); setTravelStep('packages'); }
                     else if (travelStep === 'packages') { setSelectedPackage(item); setTravelStep('booking'); }
                  }}>
                    <div className="data-card-title">{item.district_name || item.destination_name || item.hotel_name || item.package_name || item.name}</div>
                    {travelStep !== 'districts' && Object.entries(item).filter(([k]) => !['id', 'district_code', 'destination_id', 'hotel_id', 'package_id'].includes(k)).map(([k, v]) => (
                      <div key={k} className="data-card-field">
                        <span className="data-card-field-label">{k.replace('_', ' ')}:</span> <span>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {travelStep === 'booking' && (
              <form onSubmit={handleBookingSubmit}>
                {bookingMsg.text && <div className={`msg ${bookingMsg.type}`}>{bookingMsg.text}</div>}
                <div className="form-group"><label>Booking ID</label><input type="text" className="form-input" value={bookingForm.booking_id} onChange={e => setBookingForm({ ...bookingForm, booking_id: e.target.value })} required /></div>
                <div className="form-group"><label>Tourist ID</label><input type="text" className="form-input" value={bookingForm.tourist_id} onChange={e => setBookingForm({ ...bookingForm, tourist_id: e.target.value })} required /></div>
                <div className="form-group"><label>Booking Date</label><input type="date" className="form-input" value={bookingForm.booking_date} disabled /></div>
                <div className="form-group"><label>Travel Date</label><input type="date" className="form-input" value={bookingForm.travel_date} onChange={e => setBookingForm({ ...bookingForm, travel_date: e.target.value })} required /></div>
                <button type="submit" className="btn">Confirm Trip</button>
              </form>
            )}
            {travelStep === 'payment' && <div className="text-center-p2"><h3>Cost: ₹{selectedPackage.total_cost}</h3><button className="btn" onClick={handlePaymentSubmit}>Pay Now</button></div>}
            {travelStep === 'success' && <div className="text-center-p2"><h3>Success!</h3><button className="btn btn-secondary" onClick={() => navigateToStep('districts')}>New Journey</button></div>}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="card tab-content-reveal">
            {userRole === 'none' ? (
              <div className="login-container">
                <h2 className="main-tab-title" style={{ textAlign: 'center' }}>Portal Access</h2>
                <input type="text" className="form-input" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="Portal Access ID" />
                <div className="grid-cards" style={{ marginTop: '1rem' }}><button className="btn" onClick={() => handleLogin('tourist')}>Tourist</button><button className="btn" onClick={() => handleLogin('district_officer')}>Officer</button><button className="btn" onClick={() => handleLogin('hotel_manager')}>Manager</button></div>
              </div>
            ) : (
                <div className="dashboard-view">
                   <div className="flex-between">
                      <h2 className="main-tab-title">
                        {userRole === 'tourist' ? 'Tourist Dashboard' : userRole === 'district_officer' ? 'District Officer Dashboard' : 'Hotel Manager Dashboard'}
                      </h2>
                      <button className="btn btn-secondary btn-small" onClick={handleLogout}>Logout</button>
                   </div>
                   {loadMsg && <p className="msg success">{loadMsg}</p>}
                   
                   {/* Tourist Dashboard */}
                   {userRole === 'tourist' && (
                     <div className="grid-cards">
                        {dashboardData?.map(b => (
                          <div key={b.booking_id} className="data-card">
                             <div className="data-card-title">{b.package_id?.package_name}</div>
                             <div className="data-card-field"><span className="data-card-field-label">Destination:</span> <span>{b.package_id?.destination_id?.destination_name || 'N/A'}</span></div>
                             <div className="data-card-field"><span className="data-card-field-label">Date:</span> <span>{b.travel_date}</span></div>
                             <div className="data-card-field"><span className="data-card-field-label">Cost:</span> <span>₹{b.package_id?.total_cost}</span></div>
                             <div className="data-card-field"><span className="data-card-field-label">Duration:</span> <span>{b.package_id?.duration_days} Days</span></div>
                          </div>
                        ))}
                     </div>
                   )}
                   
                   {/* District Officer Dashboard */}
                   {userRole === 'district_officer' && (
                      <div className="grid-cards">
                         <div className="data-card"><div className="data-card-field-label">District</div><div className="stat-title-lg">{dashboardData?.district_name}</div></div>
                         <div className="data-card"><div className="data-card-field-label">Destinations</div><div className="stat-value-xl">{dashboardData?.dest_count}</div></div>
                         <div className="data-card"><div className="data-card-field-label">Total Tourists</div><div className="stat-value-xl">{dashboardData?.total_tourists}</div></div>
                         <div className="data-card"><div className="data-card-field-label">Avg Revenue</div><div className="stat-value-xl-accent">₹{dashboardData?.avg_revenue}</div></div>
                      </div>
                   )}

                   {/* Hotel Manager Dashboard */}
                   {userRole === 'hotel_manager' && (
                      <div className="grid-cards">
                         {dashboardData?.map(pkg => (
                            <div className="data-card" key={pkg.package_id}>
                               <div className="data-card-title">{pkg.package_name}</div>
                               <div className="data-card-field"><span className="data-card-field-label">Cost:</span> <span>₹{pkg.total_cost}</span></div>
                               <div className="data-card-field"><span className="data-card-field-label">Bookings:</span> <span>{pkg.booking_count}</span></div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
