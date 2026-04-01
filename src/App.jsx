import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('register') // 'register', 'plan'

  // Tourist Form State
  const [touristForm, setTouristForm] = useState({
    tourist_id: '',
    name: '',
    phone: '',
    email: '',
    nationality: ''
  })
  const [touristMsg, setTouristMsg] = useState({ type: '', text: '' })

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

  // -- Wizard Handlers -- //
  useEffect(() => {
    if (activeTab === 'plan') {
      if (travelStep === 'districts') fetchDistricts()
      else if (travelStep === 'destinations' && selectedDistrict) fetchDestinations()
      else if (travelStep === 'hotels' && selectedDestination) fetchHotels()
      else if (travelStep === 'packages' && selectedDestination) fetchPackages()
    }
  }, [travelStep, activeTab])

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
        <p style={{ color: 'var(--text-muted)' }}>Kerala Tourism Management System</p>
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
          onClick={() => { setActiveTab('plan'); if(travelStep === 'success') navigateToStep('districts'); }}
        >
          Plan Your Travel
        </button>
      </div>

      <main>
        {/* -- TOURIST REGISTER TAB -- */}
        {activeTab === 'register' && (
          <div className="card">
            <h2>Register Tourist</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Insert a new record into the <code style={{color: 'var(--accent)'}}>tourist</code> table.
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{textTransform: 'capitalize', margin: 0}}>{travelStep === 'success' ? 'Booking Complete' : travelStep}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {travelStep !== 'districts' && travelStep !== 'payment' && travelStep !== 'success' && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.9rem' }}
                    onClick={handleGoBack}
                  >
                    &larr; Go Back
                  </button>
                )}
                {travelStep !== 'payment' && travelStep !== 'success' && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => navigateToStep('districts')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Home
                  </button>
                )}
              </div>
            </div>
            
            {/* Drill Down Steps */}
            {['districts', 'destinations', 'hotels', 'packages'].includes(travelStep) && (
               <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
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
                      <input type="text" className="form-input" value={bookingForm.booking_id} onChange={(e)=>setBookingForm({...bookingForm, booking_id: e.target.value})} required/>
                    </div>
                    <div className="form-group">
                      <label>Tourist ID</label>
                      <input type="text" className="form-input" value={bookingForm.tourist_id} onChange={(e)=>setBookingForm({...bookingForm, tourist_id: e.target.value})} required/>
                    </div>
                    <div className="form-group">
                      <label>Travel Date</label>
                      <input type="date" className="form-input" value={bookingForm.travel_date} onChange={(e)=>setBookingForm({...bookingForm, travel_date: e.target.value})} required/>
                    </div>
                    <button type="submit" className="btn">Confirm Booking</button>
                  </form>
               </div>
            )}

            {/* PAYMENT STEP */}
            {travelStep === 'payment' && (
               <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <h3 style={{color: 'var(--accent)', marginBottom: '1rem'}}>Complete Your Payment</h3>
                  {paymentMsg.text && (
                    <div className={`msg ${paymentMsg.type}`}>{paymentMsg.text}</div>
                  )}
                  <p style={{marginBottom: '2rem', color: 'var(--text-muted)'}}>
                    Booking Ref: {currentBooking?.booking_id}<br/>
                    Amount Due(INR): {selectedPackage?.total_cost || 0}
                  </p>
                  <button onClick={handlePaymentSubmit} className="btn" style={{ maxWidth: '300px' }}>
                    Pay Now
                  </button>
               </div>
            )}

            {/* SUCCESS STEP */}
            {travelStep === 'success' && (
               <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                  <h3 style={{color: 'var(--success)'}}>Payment Successful!</h3>
                  <p style={{color: 'var(--text-muted)', marginTop: '1rem'}}>
                    Your database has successfully recorded the Tourist, Booking, and Payment.<br/>
                    You're all set!
                  </p>
                  <br/>
                  <button className="btn btn-secondary" onClick={() => navigateToStep('districts')} style={{maxWidth: '200px'}}>
                    Start New Plan
                  </button>
               </div>
            )}

          </div>
        )}
      </main>
    </div>
  )
}

export default App
