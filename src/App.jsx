import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Home, UserPlus, Map as MapIcon, LayoutDashboard, ArrowRight, UserCircle2, Building, MapPin, Sparkles, Star, Map, Calendar, DollarSign, Users, Briefcase, Navigation, UserCheck, MessageSquare, Clock } from 'lucide-react'
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
  const [packageReviews, setPackageReviews] = useState([])

  // Review System State
  const [isReviewing, setIsReviewing] = useState(null)
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [reviewMsg, setReviewMsg] = useState({ type: '', text: '' })

  const [destinationForm, setDestinationForm] = useState({ destination_id: '', destination_name: '', best_season: '', description: '' })
  const [destinationMsg, setDestinationMsg] = useState({ type: '', text: '' })
  const [showAddDestination, setShowAddDestination] = useState(false)

  const [packageForm, setPackageForm] = useState({ package_id: '', package_name: '', duration_days: '', total_cost: '', guide_name: '', itinerary: '' })
  const [packageMsg, setPackageMsg] = useState({ type: '', text: '' })
  const [showAddPackage, setShowAddPackage] = useState(false)

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
     setLoadMsg('Syncing Inventory...'); try {
        // First get hotel details (specifically destination_id)
        const { data: hotel, error: hotelErr } = await supabase.from('hotel').select('*').ilike('hotel_id', loggedInUser).single()
        if (hotelErr) throw hotelErr

        // Then get packages
        const { data, error } = await supabase
          .from('package')
          .select('*, booking(count)')
          .ilike('hotel_id', loggedInUser)
        
        if (error) throw error
        
        const optimizedPkgs = (data || []).map(pkg => ({
          ...pkg,
          booking_count: pkg.booking?.[0]?.count || 0
        }))

        setDashboardData({ hotelInfo: hotel, packages: optimizedPkgs })
        setLoadMsg('')
     } catch (err) { setLoadMsg('Error: ' + err.message) }
  }

  const handlePackageSubmit = async (e) => {
    e.preventDefault(); setPackageMsg({ type: '', text: '' });
    try {
      const payload = {
        ...packageForm,
        hotel_id: dashboardData.hotelInfo.hotel_id,
        destination_id: dashboardData.hotelInfo.destination_id
      };
      const { error } = await supabase.from('package').insert([payload]);
      if (error) throw error;
      setPackageMsg({ type: 'success', text: 'Package Added Successfully!' });
      setTimeout(() => {
        setShowAddPackage(false);
        setPackageForm({ package_id: '', package_name: '', duration_days: '', total_cost: '', guide_name: '', itinerary: '' });
        setPackageMsg({ type: '', text: '' });
        fetchHotelManagerDashboard(); 
      }, 2000);
    } catch (err) { setPackageMsg({ type: 'error', text: err.message }); }
  }

  const handleDestinationSubmit = async (e) => {
    e.preventDefault(); setDestinationMsg({ type: '', text: '' });
    try {
      const payload = {
        destination_id: destinationForm.destination_id,
        destination_name: destinationForm.destination_name,
        best_season: destinationForm.best_season,
        description: destinationForm.description,
        district_code: dashboardData.district_code
      };
      const { error } = await supabase.from('destination').insert([payload]);
      if (error) throw error;
      setDestinationMsg({ type: 'success', text: 'Destination Added Successfully!' });
      setTimeout(() => {
        setShowAddDestination(false);
        setDestinationForm({ destination_id: '', destination_name: '', best_season: '', description: '' });
        setDestinationMsg({ type: '', text: '' });
        fetchDistrictOfficerDashboard(); 
      }, 2000);
    } catch (err) { setDestinationMsg({ type: 'error', text: err.message }); }
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault(); setReviewMsg({ type: '', text: '' });
    if (!loggedInUser) return;
    try {
      // 1. Get Tourist Name
      const { data: t } = await supabase.from('tourist').select('name').ilike('tourist_id', loggedInUser).single()
      
      const payload = {
        package_id: isReviewing.package_id?.package_id || isReviewing.package_id?.id,
        tourist_name: t?.name || 'Tourist',
        comment: reviewForm.comment,
        rating: reviewForm.rating
      }

      const { error } = await supabase.from('review').insert([payload])
      if (error) throw error
      
      setReviewMsg({ type: 'success', text: 'Thank you for your feedback!' })
      setTimeout(() => { setIsReviewing(null); setReviewForm({ rating: 5, comment: '' }); setReviewMsg({ type: '', text: '' }); }, 2000)
    } catch (err) { setReviewMsg({ type: 'error', text: err.message }) }
  }

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const { error } = await supabase.from('booking').delete().eq('booking_id', bookingId)
      if (error) throw error
      fetchTouristDashboard() // Refresh data
    } catch (err) { alert('Cancellation failed: ' + err.message) }
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

  const fetchReviewsForPackage = async (pkg) => {
    try {
      const pid = pkg.package_id || pkg.id;
      const { data } = await supabase.from('review').select('*').eq('package_id', pid);
      if (data && data.length > 0) {
        setPackageReviews(data);
      } else {
        // Fallback mock reviews if none from DB
        setPackageReviews([
          { review_id: '1', tourist_name: 'Anjali Sharma', rating: 5, comment: 'Absolutely breathtaking views and perfect arrangements! Our guide was very knowledgeable.' },
          { review_id: '2', tourist_name: 'David Smith', rating: 4, comment: 'Great package overall. The accommodations were fantastic but the travel took a bit longer than expected.' }
        ]);
      }
    } catch (err) {
       console.log('Error fetching reviews:', err);
       setPackageReviews([{ review_id: 'f1', tourist_name: 'System Mock', rating: 5, comment: 'Awesome trip! (Mock Data)' }]);
    }
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
          <button className={`nav-btn ${activeTab === 'welcome' ? 'active' : ''}`} onClick={() => setActiveTab('welcome')}><Home size={18} /> Welcome</button>
          <button className={`nav-btn ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}><UserPlus size={18} /> Register</button>
          <button className={`nav-btn ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}><MapIcon size={18} /> Plan Trip</button>
          <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
        </nav>
      </aside>

      <main className="main-content">
        {activeTab === 'welcome' && (
          <div className="welcome-card tab-content-reveal">
            <div className="welcome-content-full">
               <div className="tag-pill">
                  <Sparkles size={14} className="tag-icon" /> <span>DISCOVER THE MAGIC</span>
               </div>
               <h2 className="welcome-title-large">Kerala Tourism<br/>Management</h2>
               <p className="welcome-narrative">Experience God's Own Country in its purest form. Plan seamless trips, book top-rated packages, and unlock breathtaking adventures—all in one place.</p>
               
               <div className="features-row">
                 <div className="feature-card">
                   <div className="feature-icon"><Map size={24} color="#4ADE80" /></div>
                   <h3 className="feature-title">Tailored Plans</h3>
                   <p className="feature-desc">Explore diverse districts and destinations mapped for you.</p>
                 </div>
                 <div className="feature-card">
                   <div className="feature-icon"><Building size={24} color="#F87171" /></div>
                   <h3 className="feature-title">Premium Hotels</h3>
                   <p className="feature-desc">Find luxurious and highly-rated accommodations.</p>
                 </div>
                 <div className="feature-card">
                   <div className="feature-icon"><Star size={24} color="#FBBF24" /></div>
                   <h3 className="feature-title">Easy Booking</h3>
                   <p className="feature-desc">Sign up once and handle secure trip bookings instantly.</p>
                 </div>
               </div>

               <div className="welcome-actions">
                 <button className="btn btn-glow welcome-action-btn" onClick={() => setActiveTab('plan')}>EXPLORE PACKAGES &rarr;</button>
                 <button className="btn btn-outline welcome-action-btn" onClick={() => setActiveTab('register')}>REGISTER HERE</button>
               </div>
            </div>
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
                     else if (travelStep === 'packages') { 
                       setSelectedPackage(item); 
                       fetchReviewsForPackage(item);
                       setTravelStep('booking'); 
                     }
                  }}>
                    <div className="data-card-title">{item.district_name || item.destination_name || item.hotel_name || item.package_name || item.name}</div>
                    {travelStep === 'packages' && item.duration_days && (
                      <div className="data-card-field" style={{marginBottom: '8px', color: 'var(--accent)'}}>
                        <Clock size={14} /> <span>Duration: {item.duration_days} Days</span>
                      </div>
                    )}
                    {travelStep !== 'districts' && Object.entries(item).filter(([k]) => !['id', 'district_code', 'destination_id', 'hotel_id', 'package_id', 'duration_days'].includes(k)).map(([k, v]) => (
                      <div key={k} className="data-card-field">
                        <span className="data-card-field-label">{k.replace('_', ' ')}:</span> <span>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {travelStep === 'booking' && (
              <div className="booking-layout">
                <div className="package-details-sidebar">
                  <div className="package-featured-info">
                    <h3 className="package-title-md">{selectedPackage.package_name || 'Selected Package'}</h3>
                    <div className="rating-summary">
                      <Star size={18} fill="#FBBF24" color="#FBBF24" /> 
                      <span className="rating-val">{selectedPackage.avg_rating || '4.8'}</span> 
                      <span className="rating-count">({selectedPackage.ratings_count || '124'} Reviews)</span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-header"><UserCheck size={18} className="text-accent" /> <h4>Assigned Guide</h4></div>
                    <div className="guide-card">
                       <div className="guide-avatar"><UserCircle2 size={32} color="#a1a1aa" /></div>
                       <div className="guide-info">
                         <div className="guide-name">{selectedPackage.guide_name || 'Ramesh Kumar (Certified Guide)'}</div>
                         <div className="guide-role">Kerala Tourism Expert</div>
                       </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-header"><Clock size={18} className="text-accent" /> <h4>Trip Itinerary</h4></div>
                    <div className="itinerary-timeline">
                      {(selectedPackage.itinerary || 'Day 1: Arrival & Local Sightseeing | Day 2: Excursion to major attraction | Day 3: Shopping & Departure').split('|').map((day, dIdx) => (
                        <div key={dIdx} className="timeline-item">
                           <div className="timeline-dot"></div>
                           <div className="timeline-content">{day.trim()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-header flex-between">
                       <div style={{display:'flex',gap:'8px',alignItems:'center'}}><MessageSquare size={18} className="text-accent" /> <h4>Recent Reviews</h4></div>
                    </div>
                    <div className="reviews-list">
                      {packageReviews.map(r => (
                        <div key={r.review_id} className="review-card">
                           <div className="review-header">
                              <span className="reviewer-name">{r.tourist_name}</span>
                              <div className="review-stars">
                                {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < r.rating ? "#FBBF24" : "none"} color={i < r.rating ? "#FBBF24" : "#4B5563"} />)}
                              </div>
                           </div>
                           <p className="review-comment">"{r.comment}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="booking-form-container">
                  <h3 className="form-title">Confirm Booking</h3>
                  <form onSubmit={handleBookingSubmit} className="booking-form-box">
                    {bookingMsg.text && <div className={`msg ${bookingMsg.type}`}>{bookingMsg.text}</div>}
                    <div className="form-group"><label>Booking ID</label><input type="text" className="form-input" value={bookingForm.booking_id} onChange={e => setBookingForm({ ...bookingForm, booking_id: e.target.value })} required /></div>
                    <div className="form-group"><label>Tourist ID</label><input type="text" className="form-input" value={bookingForm.tourist_id} onChange={e => setBookingForm({ ...bookingForm, tourist_id: e.target.value })} required /></div>
                    <div className="form-group"><label>Booking Date</label><input type="date" className="form-input" value={bookingForm.booking_date} disabled /></div>
                    <div className="form-group"><label>Travel Date</label><input type="date" className="form-input" value={bookingForm.travel_date} onChange={e => setBookingForm({ ...bookingForm, travel_date: e.target.value })} required /></div>
                    <div className="price-summary-box">
                      <div className="flex-between"><span>Package Cost:</span> <span>₹{selectedPackage.total_cost || '--'}</span></div>
                    </div>
                    <button type="submit" className="btn btn-full">Proceed to Payment</button>
                  </form>
                </div>
              </div>
            )}
            {travelStep === 'payment' && <div className="text-center-p2"><h3>Cost: ₹{selectedPackage.total_cost}</h3><button className="btn" onClick={handlePaymentSubmit}>Pay Now</button></div>}
            {travelStep === 'success' && <div className="text-center-p2"><h3>Success!</h3><button className="btn btn-secondary" onClick={() => navigateToStep('districts')}>New Journey</button></div>}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="card tab-content-reveal">
            {userRole === 'none' ? (
              <div className="login-wrapper">
                <div className="login-container tab-content-reveal">
                  <div className="login-icon-header">
                     <UserCircle2 size={48} className="text-accent-mb1" style={{ color: 'var(--accent)', margin: '0 auto 1rem auto' }} />
                  </div>
                  <h2 className="main-tab-title" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Portal Access</h2>
                  <p className="text-muted" style={{ textAlign: 'center', marginBottom: '2rem' }}>Sign in to manage your bookings or properties</p>
                  <div className="form-group">
                     <input type="text" className="form-input login-input" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="Enter unique ID (e.g. T01...)" />
                  </div>
                  <div className="login-actions">
                     <button className="btn btn-login-role" onClick={() => handleLogin('tourist')}><UserCircle2 size={16} /> Tourist</button>
                     <button className="btn btn-login-role" onClick={() => handleLogin('district_officer')}><MapPin size={16} /> District Officer</button>
                     <button className="btn btn-login-role" onClick={() => handleLogin('hotel_manager')}><Building size={16} /> Hotel Manager</button>
                  </div>
                  <div className="login-divider"><span>OR</span></div>
                  <div className="register-prompt">
                    <p className="text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>New here? Create an account</p>
                    <button className="btn btn-secondary btn-register-new" onClick={() => setActiveTab('register')} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}><UserPlus size={16} /> Register as Tourist</button>
                  </div>
                </div>
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
                   {userRole === 'tourist' && dashboardData && (
                     <div className="tourist-dash-container">
                        {/* Upcoming Section */}
                        <div className="dash-section-header">
                           <Clock size={20} className="text-accent" /> <h3>Upcoming Adventures</h3>
                        </div>
                        <div className="grid-cards-mb3">
                           {dashboardData.filter(b => new Date(b.travel_date) >= new Date().setHours(0,0,0,0)).map(b => (
                            <div key={b.booking_id} className="data-card upcoming-border">
                               <div className="data-card-title flex-between"><span>{b.package_id?.package_name}</span> <Navigation size={20} className="text-accent" /></div>
                               <div className="data-card-field-box">
                                  <div className="data-card-field"><MapPin size={14} className="text-muted"/> <span>{b.package_id?.destination_id?.destination_name || 'N/A'}</span></div>
                                  <div className="data-card-field"><Calendar size={14} className="text-muted"/> <span>{b.travel_date}</span></div>
                                  <div className="data-card-field"><DollarSign size={14} className="text-muted"/> <span>₹{b.package_id?.total_cost}</span></div>
                               </div>
                               {/* Cancellation logic: 3 days prior */}
                               {((new Date(b.travel_date) - new Date()) / (1000 * 60 * 60 * 24)) >= 3 && (
                                 <button className="btn btn-cancel" onClick={() => handleCancelBooking(b.booking_id)}>
                                    Cancel Booking
                                 </button>
                               )}
                            </div>
                           ))}
                           {dashboardData.filter(b => new Date(b.travel_date) >= new Date().setHours(0,0,0,0)).length === 0 && <p className="text-muted-centered">No upcoming trips planned. Ready for a new journey?</p>}
                        </div>

                        {/* Recent Section */}
                        <div className="dash-section-header" style={{marginTop:'3rem'}}>
                           <Sparkles size={20} className="text-accent" /> <h3>Previous Journeys</h3>
                        </div>
                        <div className="grid-cards">
                           {dashboardData.filter(b => new Date(b.travel_date) < new Date().setHours(0,0,0,0)).map(b => (
                            <div key={b.booking_id} className="data-card previous-style">
                               <div className="data-card-title">{b.package_id?.package_name}</div>
                               <div className="data-card-field-box">
                                 <div className="data-card-field"><MapPin size={14} className="text-muted"/> <span>{b.package_id?.destination_id?.destination_name}</span></div>
                                 <div className="data-card-field"><Calendar size={14} className="text-muted"/> <span>{b.travel_date}</span></div>
                               </div>
                               <button className="btn btn-review-add" onClick={() => setIsReviewing(b)}>
                                  <MessageSquare size={16} /> Add Review
                               </button>
                            </div>
                           ))}
                        </div>
                     </div>
                   )}

                   {/* Review Modal */}
                   {isReviewing && (
                     <div className="modal-overlay">
                        <div className="modal-content review-modal tab-content-reveal">
                           <div className="flex-between"><h3>How was your trip?</h3><button className="btn-close" onClick={() => setIsReviewing(null)}>&times;</button></div>
                           <p className="text-muted-sm mb-2">Sharing your experience helps other travelers discover God's Own Country.</p>
                           {reviewMsg.text && <div className={`msg ${reviewMsg.type}`}>{reviewMsg.text}</div>}
                           <form onSubmit={handleReviewSubmit}>
                              <div className="form-group text-center">
                                 <label>Rating</label>
                                 <div className="star-rating-select">
                                    {[1,2,3,4,5].map(s => (
                                      <Star key={s} size={28} fill={s <= reviewForm.rating ? "var(--accent)" : "none"} color={s <= reviewForm.rating ? "var(--accent)" : "#94A3B8"} onClick={() => setReviewForm({...reviewForm, rating: s})} style={{cursor:'pointer'}} />
                                    ))}
                                 </div>
                              </div>
                              <div className="form-group">
                                 <label>Comment</label>
                                 <textarea className="form-input text-area" placeholder="Tell us about the sights, the guide, and your overall experience..." value={reviewForm.comment} onChange={e => setReviewForm({...reviewForm, comment: e.target.value})} required rows={4}></textarea>
                              </div>
                              <button type="submit" className="btn btn-full">Post Feedback</button>
                           </form>
                        </div>
                     </div>
                   )}
                   
                   {/* District Officer Dashboard */}
                   {userRole === 'district_officer' && (
                      <div className="district-officer-dash-container">
                         <div className="grid-cards">
                            <div className="data-card"><div className="data-card-field-label flex-between"><span>District</span> <MapPin size={18} className="text-accent"/></div><div className="stat-title-lg" style={{marginTop:'10px'}}>{dashboardData?.district_name}</div></div>
                            <div className="data-card"><div className="data-card-field-label flex-between"><span>Destinations</span> <MapIcon size={18} className="text-accent"/></div><div className="stat-value-xl" style={{marginTop:'10px'}}>{dashboardData?.dest_count}</div></div>
                            <div className="data-card"><div className="data-card-field-label flex-between"><span>Total Tourists</span> <Users size={18} className="text-accent"/></div><div className="stat-value-xl" style={{marginTop:'10px'}}>{dashboardData?.total_tourists}</div></div>
                            <div className="data-card"><div className="data-card-field-label flex-between"><span>Avg Revenue</span> <DollarSign size={18} color="#4ADE80"/></div><div className="stat-value-xl-accent" style={{marginTop:'10px'}}>₹{dashboardData?.avg_revenue}</div></div>
                         </div>
                         <div className="dash-section-header" style={{marginTop:'3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}><MapPin size={20} className="text-accent" /> <h3>Manage Destinations</h3></div>
                            <button className="btn btn-small" onClick={() => setShowAddDestination(true)}>+ Add Destination</button>
                         </div>
                      </div>
                   )}

                   {/* Add Destination Modal */}
                   {showAddDestination && (
                     <div className="modal-overlay">
                        <div className="modal-content tab-content-reveal">
                           <div className="flex-between"><h3>Add New Destination</h3><button className="btn-close" onClick={() => setShowAddDestination(false)}>&times;</button></div>
                           <p className="text-muted-sm mb-2">Register a new destination in your district.</p>
                           {destinationMsg.text && <div className={`msg ${destinationMsg.type}`}>{destinationMsg.text}</div>}
                           <form onSubmit={handleDestinationSubmit}>
                              <div className="form-group">
                                 <label>District Code</label>
                                 <input type="text" className="form-input" value={dashboardData?.district_code || ''} disabled />
                              </div>
                              <div className="form-group">
                                 <label>Destination ID (Manual)</label>
                                 <input type="text" className="form-input" value={destinationForm.destination_id} onChange={e => setDestinationForm({...destinationForm, destination_id: e.target.value})} required />
                              </div>
                              <div className="form-group">
                                 <label>Destination Name</label>
                                 <input type="text" className="form-input" value={destinationForm.destination_name} onChange={e => setDestinationForm({...destinationForm, destination_name: e.target.value})} required />
                              </div>
                              <div className="form-group">
                                 <label>Best Season</label>
                                 <input type="text" className="form-input" value={destinationForm.best_season} onChange={e => setDestinationForm({...destinationForm, best_season: e.target.value})} placeholder="e.g., September to March" required />
                              </div>
                              <div className="form-group">
                                 <label>Description</label>
                                 <textarea className="form-input text-area" placeholder="Brief details about the destination..." value={destinationForm.description} onChange={e => setDestinationForm({...destinationForm, description: e.target.value})} required rows={3}></textarea>
                              </div>
                              <div className="modal-actions" style={{display:'flex', gap:'1rem', marginTop:'2rem'}}>
                                 <button type="button" className="btn btn-outline" style={{flex:1}} onClick={() => setShowAddDestination(false)}>Back</button>
                                 <button type="submit" className="btn" style={{flex:2}}>Register Destination</button>
                              </div>
                           </form>
                        </div>
                     </div>
                   )}

                   {/* Hotel Manager Dashboard */}
                   {userRole === 'hotel_manager' && dashboardData && (
                      <div className="hotel-manager-dash-container">
                         <div className="grid-cards">
                            {dashboardData.packages?.map(pkg => (
                               <div className="data-card" key={pkg.package_id}>
                                  <div className="data-card-title flex-between"><span>{pkg.package_name}</span> <Briefcase size={20} className="text-accent"/></div>
                                  <div className="data-card-field" style={{display:'flex', alignItems:'center', gap:'6px'}}><Clock size={14} className="text-muted"/> <span className="data-card-field-label">Duration:</span> <span style={{color:'#fff'}}>{pkg.duration_days || 'N/A'} Days</span></div>
                                  <div className="data-card-field" style={{display:'flex', alignItems:'center', gap:'6px'}}><DollarSign size={14} className="text-muted"/> <span className="data-card-field-label">Cost:</span> <span style={{color:'#fff'}}>₹{pkg.total_cost}</span></div>
                                  <div className="data-card-field" style={{display:'flex', alignItems:'center', gap:'6px'}}><Users size={14} className="text-muted"/> <span className="data-card-field-label">Bookings:</span> <span style={{color:'#fff'}}>{pkg.booking_count}</span></div>
                               </div>
                            ))}
                         </div>
                         <div className="dash-section-header" style={{marginTop:'3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}><Briefcase size={20} className="text-accent" /> <h3>Manage Packages</h3></div>
                            <button className="btn btn-small" onClick={() => setShowAddPackage(true)}>+ Add Package</button>
                         </div>
                      </div>
                   )}

                   {/* Add Package Modal */}
                   {showAddPackage && (
                     <div className="modal-overlay">
                        <div className="modal-content tab-content-reveal">
                           <div className="flex-between"><h3>Add New Package</h3><button className="btn-close" onClick={() => setShowAddPackage(false)}>&times;</button></div>
                           <p className="text-muted-sm mb-2">Register a new tour package for your hotel.</p>
                           {packageMsg.text && <div className={`msg ${packageMsg.type}`}>{packageMsg.text}</div>}
                           <form onSubmit={handlePackageSubmit}>
                              <div className="form-group">
                                 <label>Hotel ID</label>
                                 <input type="text" className="form-input" value={dashboardData?.hotelInfo?.hotel_id || ''} disabled />
                              </div>
                              <div className="form-group">
                                 <label>Package ID (Manual)</label>
                                 <input type="text" className="form-input" value={packageForm.package_id} onChange={e => setPackageForm({...packageForm, package_id: e.target.value})} placeholder="e.g., PKG_001" required />
                              </div>
                              <div className="form-group">
                                 <label>Package Name</label>
                                 <input type="text" className="form-input" value={packageForm.package_name} onChange={e => setPackageForm({...packageForm, package_name: e.target.value})} required />
                               </div>
                               <div className="form-row" style={{display:'flex', gap:'1rem'}}>
                                 <div className="form-group" style={{flex:1}}>
                                    <label>Duration (Days)</label>
                                    <input type="number" className="form-input" value={packageForm.duration_days} onChange={e => setPackageForm({...packageForm, duration_days: e.target.value})} required />
                                 </div>
                                 <div className="form-group" style={{flex:1}}>
                                    <label>Total Cost (₹)</label>
                                    <input type="number" className="form-input" value={packageForm.total_cost} onChange={e => setPackageForm({...packageForm, total_cost: e.target.value})} required />
                                 </div>
                               </div>
                               <div className="form-group">
                                  <label>Assigned Guide Name</label>
                                  <input type="text" className="form-input" value={packageForm.guide_name} onChange={e => setPackageForm({...packageForm, guide_name: e.target.value})} required />
                               </div>
                               <div className="form-group">
                                  <label>Itinerary</label>
                                  <textarea className="form-input text-area" placeholder="Day 1: ... | Day 2: ... | Day 3: ..." value={packageForm.itinerary} onChange={e => setPackageForm({...packageForm, itinerary: e.target.value})} required rows={3}></textarea>
                               </div>
                               <div className="modal-actions">
                                  <button type="button" className="btn btn-outline" onClick={() => setShowAddPackage(false)}>Back</button>
                                  <button type="submit" className="btn">Register Package</button>
                               </div>
                            </form>
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
