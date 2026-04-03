import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './index.css'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('register') // 'register', 'plan', 'dashboard'
  const [userRole, setUserRole] = useState('none') // 'none', 'tourist', 'district_officer', 'hotel_manager'
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [loginId, setLoginId] = useState('')

  // Tourist Form State
  const [touristForm, setTouristForm] = useState({
    tourist_id: '',
    name: '',
    phone: '',
    email: '',
    nationality: ''
  })
  const [touristMsg, setTouristMsg] = useState({ type: '', text: '' })

  // Dashboard Specific States
  const [dashboardData, setDashboardData] = useState(null)
  const [pastDestinations, setPastDestinations] = useState([])
  const [loadMsg, setLoadMsg] = useState('')

  // -- Role Login Logic -- //
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
    setActiveTab('register')
  }

  // Plan Your Travel Workflow State
  const [travelStep, setTravelStep] = useState('districts')
  // steps: 'districts' | 'destinations' | 'hotels' | 'packages' | 'booking' | 'payment' | 'success'

  const [viewLoading, setViewLoading] = useState(false)
  const [dataList, setDataList] = useState([])

  // Selection states
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [selectedDestination, setSelectedDestination] = useState(null)
  const [selectedHotel, setSelectedHotel] = useState(null)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [currentBooking, setCurrentBooking] = useState(null)

  // Booking Form State within Workflow
  const [bookingForm, setBookingForm] = useState({
    booking_id: '',
    tourist_id: '',
    travel_date: ''
  })
  const [bookingMsg, setBookingMsg] = useState({ type: '', text: '' })
  // Payment Form State
  const [paymentMsg, setPaymentMsg] = useState({ type: '', text: '' })
  // Payment Amount is derived from selectedPackage.total_cost

  // -- Tourist Handlers -- //
  const handleTouristChange = (e) => {
    setTouristForm({ ...touristForm, [e.target.name]: e.target.value })
  }

  const handleRegisterTourist = async (e) => {
    e.preventDefault()
    setTouristMsg({ type: '', text: '' })
    try {
      const { data, error } = await supabase.from('tourist').insert([touristForm])
      if (error) throw error
      setTouristMsg({ type: 'success', text: 'Tourist Registered Successfully' })
      setTouristForm({ tourist_id: '', name: '', phone: '', email: '', nationality: '' })
    } catch (error) {
      setTouristMsg({ type: 'error', text: error.message || 'Insertion failed' })
    }
  }

  // -- Dashboard Fetchers -- //
  const fetchTouristDashboard = async () => {
    setLoadMsg('Fetching your trips...'); setDashboardData([]); setPastDestinations([])
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: allBookings, error: bookingErr } = await supabase
        .from('booking')
        .select(`
          booking_id,
          travel_date,
          package:package_id (
            package_name,
            total_cost,
            hotel:hotel_id (
              hotel_name,
              hotel_type,
              destination:destination_id (
                destination_id,
                destination_name,
                rating
              )
            )
          )
        `)
        .ilike('tourist_id', loggedInUser)

      if (bookingErr) throw bookingErr
      
      if (!allBookings || allBookings.length === 0) {
        setLoadMsg('No bookings found for this Tourist ID.')
        return
      }

      const upcoming = allBookings.filter(b => b.travel_date >= today)
      const past = allBookings.filter(b => b.travel_date < today)
      setDashboardData(upcoming)
      
      const uniquePast = [];
      const seenDest = new Set();
      past.forEach(b => {
        const dest = b.package?.hotel?.destination;
        if (dest && !seenDest.has(dest.destination_id)) {
           seenDest.add(dest.destination_id);
           uniquePast.push(dest);
        }
      })
      setPastDestinations(uniquePast)
      setLoadMsg('')
    } catch (err) { setLoadMsg(`Error: ${err.message}`) }
  }

  const fetchDistrictOfficerDashboard = async () => {
    setLoadMsg('Fetching district stats...'); setDashboardData(null)
    try {
      // 1. Fetch static district info
      const { data: districtRows, error: districtErr } = await supabase
        .from('district')
        .select('district_name, total_tourists, district_code')
        .ilike('district_code', loggedInUser)
        .limit(1)

      if (districtErr) throw districtErr
      if (!districtRows || districtRows.length === 0) {
        setLoadMsg(`Error: No district record found for code "${loggedInUser}".`)
        return
      }

      // 2. Fetch average revenue via custom SQL function (RPC)
      const { data: avgRevenue, error: rpcErr } = await supabase
        .rpc('get_avg_revenue', { dist_code: districtRows[0].district_code })

      if (rpcErr) throw rpcErr

      setDashboardData({
        ...districtRows[0],
        avg_revenue: avgRevenue
      })
      setLoadMsg('')
    } catch (err) { 
      setLoadMsg(`Error: ${err.message}`) 
    }
  }

  const fetchHotelManagerDashboard = async () => {
    setLoadMsg('Fetching packages performance...'); setDashboardData([])
    try {
      // 1. Fetch all packages belonging to this hotel
      const { data: pkgs, error: pkgErr } = await supabase
        .from('package')
        .select(`
          package_id,
          package_name,
          total_cost,
          hotel:hotel_id ( hotel_name )
        `)
        .ilike('hotel_id', loggedInUser)
        
      if (pkgErr) throw pkgErr
      if (!pkgs || pkgs.length === 0) {
        setLoadMsg('No packages found for this hotel ID.')
        return
      }

      // 2. For each package, fetch the booking count directly from the booking table
      const formattedData = await Promise.all(pkgs.map(async (pkg) => {
        const pId = pkg.package_id;
        const { count, error: countErr } = await supabase
          .from('booking')
          .select('*', { count: 'exact', head: true })
          .eq('package_id', pId)
        
        return {
          ...pkg,
          booking_count: count || 0
        }
      }))
      
      setDashboardData(formattedData)
      setLoadMsg('')
    } catch (err) { setLoadMsg(`Error: ${err.message}`) }
  }

  const updateDestinationRating = async (destId, rating) => {
    try {
       const { error } = await supabase.from('destination').update({ rating }).eq('destination_id', destId)
       if (error) throw error
       alert('Rating updated!')
       fetchTouristDashboard()
    } catch (err) { alert(err.message) }
  }

  // -- Wizard Handlers -- //
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
      else if (travelStep === 'packages' && selectedDestination) fetchPackages()
    }
  }, [travelStep, activeTab, userRole, loggedInUser])

  const navigateToStep = (step) => {
    setTravelStep(step)
    if (step === 'districts') {
      setSelectedDistrict(null); setSelectedDestination(null); setSelectedHotel(null); setSelectedPackage(null);
    }
    if (step === 'destinations') {
      setSelectedDestination(null); setSelectedHotel(null); setSelectedPackage(null);
    }
    if (step === 'hotels') {
      setSelectedHotel(null); setSelectedPackage(null);
    }
    if (step === 'packages') {
      setSelectedPackage(null);
    }
  }

  const handleGoBack = () => {
    if (travelStep === 'destinations') navigateToStep('districts');
    else if (travelStep === 'hotels') navigateToStep('destinations');
    else if (travelStep === 'packages') navigateToStep('hotels');
    else if (travelStep === 'booking') navigateToStep('packages');
  }

  const fetchDistricts = async () => {
    setViewLoading(true); setDataList([]);
    try {
      const { data, error } = await supabase.from('district').select('*')
      if (error) throw error
      setDataList(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setViewLoading(false)
    }
  }

  const fetchDestinations = async () => {
    setViewLoading(true); setDataList([]);
    try {
      const { data, error } = await supabase.from('destination').select('*').eq('district_code', selectedDistrict.district_code || selectedDistrict.id)
      if (error) throw error
      setDataList(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setViewLoading(false)
    }
  }

  const fetchHotels = async () => {
    setViewLoading(true); setDataList([]);
    try {
      const destinationId = selectedDestination.destination_id || selectedDestination.id;
      // Assume hotel table uses destination_id 
      const { data, error } = await supabase.from('hotel').select('*').eq('destination_id', destinationId)
      if (error) throw error
      setDataList(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setViewLoading(false)
    }
  }

  const fetchPackages = async () => {
    setViewLoading(true); setDataList([]);
    try {
      // User added hotel_id foreign key to package table
      const hotelId = selectedHotel.hotel_id || selectedHotel.id;
      const { data, error } = await supabase.from('package').select('*').eq('hotel_id', hotelId)
      if (error) throw error
      setDataList(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setViewLoading(false)
    }
  }

  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    setBookingMsg({ type: '', text: '' })
    try {
      const packageId = selectedPackage.package_id || selectedPackage.id
      const bookingPayload = {
        booking_id: bookingForm.booking_id,
        tourist_id: bookingForm.tourist_id,
        package_id: packageId,
        booking_date: new Date().toISOString().split('T')[0],
        travel_date: bookingForm.travel_date
      }

      const { data, error } = await supabase.from('booking').insert([bookingPayload])
      if (error) throw error

      setCurrentBooking(bookingPayload)
      setBookingMsg({ type: 'success', text: 'Booking Setup Successful! Proceeding to Payment...' })

      // Auto advance to payment after a short delay
      setTimeout(() => setTravelStep('payment'), 1200)

    } catch (error) {
      setBookingMsg({ type: 'error', text: error.message || 'Booking failed' })
    }
  }

  const handlePaymentSubmit = async () => {
    setPaymentMsg({ type: '', text: '' })
    try {
      // Generate exactly 5 characters string to avoid VARCHAR(5) DB error (e.g. 'P' + 4 random chars)
      const randomPaymentId = 'P' + Math.random().toString(36).substring(2, 6).toUpperCase();

      const paymentPayload = {
        payment_id: randomPaymentId,
        booking_id: currentBooking?.booking_id,
        payment_amount: selectedPackage?.total_cost || 0
      }

      const { data, error } = await supabase.from('payment').insert([paymentPayload])
      if (error) {
        // Fallback for strict typo match just in case
        if (error.message && error.message.includes('payment_amount')) {
          const { error: fallbackErr } = await supabase.from('payment').insert([{
            payment_id: paymentPayload.payment_id,
            booking_id: paymentPayload.booking_id,
            payment_amout: paymentPayload.payment_amount
          }])
          if (fallbackErr) throw fallbackErr;
        } else {
          throw error
        }
      }

      setTravelStep('success')
    } catch (error) {
      console.error("Payment error full object:", error)
      setPaymentMsg({ type: 'error', text: error?.message || JSON.stringify(error) || 'An unknown error occurred' })
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>KTMS Database Portal</h1>
        <p className="text-muted-sm">Kerala Tourism Management System</p>
      </div>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          Register Tourist
        </button>
        <button
          className={`tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => { setActiveTab('plan'); if (travelStep === 'success') navigateToStep('districts'); }}
        >
          Plan Your Travel
        </button>
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
      </div>

      <main>
        {/* -- TOURIST REGISTER TAB -- */}
        {activeTab === 'register' && (
          <div className="card">
            <h2>Register Tourist</h2>
            <p className="text-muted-sm">
              Insert a new record into the <code className="code-accent">tourist</code> table.
            </p>

            {touristMsg.text && (
              <div className={`msg ${touristMsg.type}`}>
                {touristMsg.text}
              </div>
            )}

            <form onSubmit={handleRegisterTourist}>
              <div className="form-group">
                <label>Tourist ID</label>
                <input type="text" name="tourist_id" className="form-input" value={touristForm.tourist_id} onChange={handleTouristChange} required />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input type="text" name="name" className="form-input" value={touristForm.name} onChange={handleTouristChange} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="text" name="phone" className="form-input" value={touristForm.phone} onChange={handleTouristChange} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" className="form-input" value={touristForm.email} onChange={handleTouristChange} />
              </div>
              <div className="form-group">
                <label>Nationality</label>
                <input type="text" name="nationality" className="form-input" value={touristForm.nationality} onChange={handleTouristChange} />
              </div>
              <button type="submit" className="btn">Register Tourist</button>
            </form>
          </div>
        )}

        {/* -- PLAN YOUR TRAVEL TAB -- */}
        {activeTab === 'plan' && (
          <div className="card">

            {/* Breadcrumbs Navigation */}
            {travelStep !== 'success' && (
              <div className="breadcrumbs">
                <button className="crumb-btn" onClick={() => navigateToStep('districts')}>Districts</button>

                {['destinations', 'hotels', 'packages', 'booking', 'payment'].includes(travelStep) && (
                  <><span className="crumb-separator">/</span> <button className="crumb-btn" onClick={() => navigateToStep('destinations')}>Destinations</button></>
                )}

                {['hotels', 'packages', 'booking', 'payment'].includes(travelStep) && (
                  <><span className="crumb-separator">/</span> <button className="crumb-btn" onClick={() => navigateToStep('hotels')}>Hotels</button></>
                )}

                {['packages', 'booking', 'payment'].includes(travelStep) && (
                  <><span className="crumb-separator">/</span> <button className="crumb-btn" onClick={() => navigateToStep('packages')}>Packages</button></>
                )}

                {['booking', 'payment'].includes(travelStep) && (
                  <><span className="crumb-separator">/</span> <button className="crumb-btn" disabled>Booking</button></>
                )}
              </div>
            )}

            <div className="flex-between">
              <h2 className="text-capitalize-m0">{travelStep === 'success' ? 'Booking Complete' : travelStep}</h2>
              <div className="flex-gap-sm">
                {travelStep !== 'districts' && travelStep !== 'payment' && travelStep !== 'success' && (
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={handleGoBack}
                  >
                    &larr; Go Back
                  </button>
                )}
                {travelStep !== 'payment' && travelStep !== 'success' && (
                  <button
                    className="btn btn-secondary btn-home-icon"
                    onClick={() => navigateToStep('districts')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                    Home
                  </button>
                )}
              </div>
            </div>

            {/* Drill Down Steps */}
            {['districts', 'destinations', 'hotels', 'packages'].includes(travelStep) && (
              <p className="text-muted-sm">
                Select a card below to proceed.
              </p>
            )}

            {viewLoading && <p>Loading data...</p>}

            {/* CARDS RENDER */}
            {!viewLoading && ['districts', 'destinations', 'hotels', 'packages'].includes(travelStep) && (
              <div className="grid-cards">
                {dataList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No records found at this level.</p>
                ) : (
                  dataList.map((item, idx) => (
                    <div
                      key={idx}
                      className="data-card clickable"
                      onClick={() => {
                        if (travelStep === 'districts') {
                          setSelectedDistrict(item); setTravelStep('destinations');
                        } else if (travelStep === 'destinations') {
                          setSelectedDestination(item); setTravelStep('hotels');
                        } else if (travelStep === 'hotels') {
                          setSelectedHotel(item); setTravelStep('packages');
                        } else if (travelStep === 'packages') {
                          setSelectedPackage(item); setTravelStep('booking');
                        }
                      }}
                    >
                      <div className="data-card-title">
                        {item.name || item.destination_name || item.hotel_name || item.district_name || item.package_name || `Record #${idx + 1}`}
                      </div>
                      {Object.entries(item).map(([key, val]) => (
                        <div className="data-card-field" key={key}>
                          <span className="data-card-field-label">{key}:</span>
                          <span>{val !== null ? val.toString() : 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* BOOKING STEP */}
            {travelStep === 'booking' && (
              <div>
                {bookingMsg.text && <div className={`msg ${bookingMsg.type}`}>{bookingMsg.text}</div>}
                <form onSubmit={handleBookingSubmit}>
                  <div className="form-group">
                    <label>Package Selected (ID)</label>
                    <input type="text" className="form-input" disabled value={selectedPackage?.package_id || selectedPackage?.id || ''} />
                  </div>
                  <div className="form-group">
                    <label>Booking ID (Manual Entry)</label>
                    <input type="text" className="form-input" value={bookingForm.booking_id} onChange={(e) => setBookingForm({ ...bookingForm, booking_id: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Tourist ID</label>
                    <input type="text" className="form-input" value={bookingForm.tourist_id} onChange={(e) => setBookingForm({ ...bookingForm, tourist_id: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Travel Date</label>
                    <input type="date" className="form-input" value={bookingForm.travel_date} onChange={(e) => setBookingForm({ ...bookingForm, travel_date: e.target.value })} required />
                  </div>
                  <button type="submit" className="btn">Confirm Booking</button>
                </form>
              </div>
            )}

            {/* PAYMENT STEP */}
            {travelStep === 'payment' && (
              <div className="text-center-p2">
                <h3 className="text-accent-mb1">Complete Your Payment</h3>
                {paymentMsg.text && (
                  <div className={`msg ${paymentMsg.type}`}>{paymentMsg.text}</div>
                )}
                <p className="text-muted-mb2">
                  Booking Ref: {currentBooking?.booking_id}<br />
                  Amount Due(INR): {selectedPackage?.total_cost || 0}
                </p>
                <button onClick={handlePaymentSubmit} className="btn btn-max-300">
                  Pay Now
                </button>
              </div>
            )}

            {/* SUCCESS STEP */}
            {travelStep === 'success' && (
              <div className="text-center-p2">
                <div className="success-icon">🎉</div>
                <h3 className="text-success-bold">Payment Successful!</h3>
                <p className="text-muted-mt1">
                  Your database has successfully recorded the Tourist, Booking, and Payment.<br />
                  You're all set!
                </p>
                <br />
                <button className="btn btn-secondary btn-max-200" onClick={() => navigateToStep('districts')}>
                  Start New Plan
                </button>
              </div>
            )}

          </div>
        )}

        {/* -- DASHBOARD TAB -- */}
        {activeTab === 'dashboard' && (
          <div className="card">
            {userRole === 'none' ? (
              <div className="login-container">
                <h2 style={{ textAlign: 'center' }}>Dashboard Login</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'center' }}>Enter your unique ID to continue</p>
                <div className="form-group">
                  <label>Tourist ID (Name) / District Code / Hotel ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Gopika, D01, H10"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                  />
                </div>
                <div className="grid-cards" style={{ marginTop: '1rem' }}>
                  <button className="btn" onClick={() => handleLogin('tourist')}>As Tourist</button>
                  <button className="btn" onClick={() => handleLogin('district_officer')}>As District Officer</button>
                  <button className="btn" onClick={() => handleLogin('hotel_manager')}>As Hotel Manager</button>
                </div>
              </div>
            ) : (
              <div className="dashboard-view">
                <div className="dash-header">
                  <div>
                    <h2 className="dash-header-title">{userRole?.replace('_', ' ')} Dashboard</h2>
                    <p className="dash-header-user">Logged in as: {loggedInUser}</p>
                  </div>
                  <button className="btn btn-secondary dash-btn-logout" onClick={handleLogout}>Logout</button>
                </div>

                {loadMsg && (
                  <p className={`msg ${loadMsg.startsWith('Error') ? 'error' : 'success'}`}>
                    {loadMsg}
                  </p>
                )}

                {/* Tourist Dashboard UI */}
                {userRole === 'tourist' && (
                  <div className="dash-section">
                    <h3 className="dash-section-title">Upcoming Bookings</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Travel Date</th>
                            <th>Package</th>
                            <th>Hotel</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData?.length > 0 ? dashboardData.map(b => (
                            <tr key={b.booking_id || b.id}>
                              <td>{b.travel_date}</td>
                              <td>{b.package?.package_name}</td>
                              <td>{b.package?.hotel?.hotel_name}</td>
                              <td><span className="badge-success">Confirmed</span></td>
                            </tr>
                          )) : <tr><td colSpan="4" style={{ color: 'var(--text-muted)' }}>No upcoming trips found.</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    <h3 className="dash-section-title" style={{ marginTop: '2.5rem' }}>Rate Previous Destinations</h3>
                    <div className="grid-cards">
                      {pastDestinations.length > 0 ? pastDestinations.map(dest => (
                        <div className="data-card" key={dest.destination_id}>
                          <div className="data-card-title">{dest.destination_name}</div>
                          <div className="data-card-field">
                            <span className="data-card-field-label">Current Rating:</span>
                            <span className="code-accent">{dest.rating || 'No rating'} ⭐</span>
                          </div>
                          <div className="star-rating-container">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                className="star-btn"
                                style={{ color: star <= (dest.rating || 0) ? 'var(--accent)' : 'var(--text-muted)' }}
                                onClick={() => updateDestinationRating(dest.destination_id, star)}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                      )) : <p style={{ color: 'var(--text-muted)' }}>No previous trips found to rate.</p>}
                    </div>
                  </div>
                )}

                {/* District Officer Dashboard UI */}
                {userRole === 'district_officer' && (
                  <div className="dash-section">
                    <div className="grid-cards">
                      <div className="data-card stat-card-gradient">
                        <div className="data-card-field-label">District Name</div>
                        <div className="stat-title-lg">{dashboardData?.district_name || 'Loading...'}</div>
                      </div>
                      <div className="data-card">
                        <div className="data-card-field-label">Total Tourists</div>
                        <div className="stat-value-xl">{dashboardData?.total_tourists || 0}</div>
                        <div className="stat-subtitle-sm">Cumulative Visitors</div>
                      </div>
                      <div className="data-card">
                        <div className="data-card-field-label">Avg. Revenue (INR)</div>
                        <div className="stat-value-xl-accent">₹{dashboardData?.avg_revenue || 0}</div>
                        <div className="stat-subtitle-sm">Per Booking Average</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hotel Manager Dashboard UI */}
                {userRole === 'hotel_manager' && (
                  <div className="dash-section">
                    <h3 className="dash-section-title">Packages & Booking Performance</h3>
                    <div className="grid-cards">
                      {dashboardData?.length > 0 ? dashboardData.map(pkg => (
                        <div className="data-card" key={pkg.package_id || pkg.id}>
                          <div className="pkg-title-underlined">{pkg.package_name}</div>
                          <div className="data-card-field">
                            <span className="data-card-field-label">Base Cost:</span>
                            <span>₹{pkg.total_cost}</span>
                          </div>
                          <div className="data-card-field">
                            <span className="data-card-field-label">Bookings Count:</span>
                            <span className="pkg-stat-highlight">{pkg.booking_count}</span>
                          </div>
                          <div className="data-card-field pkg-desc-sm">
                            <span className="data-card-field-label">Hotel Associated:</span>
                            <span>{pkg.hotel?.hotel_name}</span>
                          </div>
                        </div>
                      )) : <p className="text-muted-sm">No packages found for your hotel ID.</p>}
                    </div>
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
