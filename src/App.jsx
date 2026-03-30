import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('register') // 'register', 'booking', 'view'

  // Tourist Form State
  const [touristForm, setTouristForm] = useState({
    tourist_id: '',
    name: '',
    phone: '',
    email: '',
    nationality: ''
  })
  const [touristMsg, setTouristMsg] = useState({ type: '', text: '' })

  // Booking Form State
  const [bookingForm, setBookingForm] = useState({
    booking_id: '',
    tourist_id: '',
    package_id: '',
    booking_date: new Date().toISOString().split('T')[0], // current date as default
    travel_date: ''
  })
  const [bookingMsg, setBookingMsg] = useState({ type: '', text: '' })

  // View Data State
  const [dataList, setDataList] = useState([])
  const [currentView, setCurrentView] = useState('') // 'tourist' or 'booking'
  const [viewLoading, setViewLoading] = useState(false)

  // -- Handlers for Tourist -- //
  const handleTouristChange = (e) => {
    setTouristForm({ ...touristForm, [e.target.name]: e.target.value })
  }

  const handleRegisterTourist = async (e) => {
    e.preventDefault()
    setTouristMsg({ type: '', text: '' })
    
    try {
      const { data, error } = await supabase
        .from('tourist')
        .insert([touristForm])
      
      if (error) throw error

      setTouristMsg({ type: 'success', text: 'Tourist Registered Successfully' })
      setTouristForm({ tourist_id: '', name: '', phone: '', email: '', nationality: '' })
      console.log("Tourist Insert Response:", data)
    } catch (error) {
      console.error("Error inserting tourist:", error)
      setTouristMsg({ type: 'error', text: error.message || 'Insertion failed' })
    }
  }

  // -- Handlers for Booking -- //
  const handleBookingChange = (e) => {
    setBookingForm({ ...bookingForm, [e.target.name]: e.target.value })
  }

  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    setBookingMsg({ type: '', text: '' })
    
    try {
      const { data, error } = await supabase
        .from('booking')
        .insert([bookingForm])
      
      // Note: Foreign key constraints on tourist_id and package_id will be handled by Supabase DB
      // and thrown back as an error if they do not exist.
      if (error) throw error

      setBookingMsg({ type: 'success', text: 'Booking Successful' })
      setBookingForm({ ...bookingForm, booking_id: '', tourist_id: '', package_id: '', travel_date: '' })
      console.log("Booking Insert Response:", data)
    } catch (error) {
      console.error("Error inserting booking:", error)
      setBookingMsg({ type: 'error', text: error.message || 'Booking failed' })
    }
  }

  // -- Handlers for Viewing Data -- //
  const fetchTableData = async (tableName) => {
    setViewLoading(true)
    setCurrentView(tableName)
    setDataList([])
    
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        
      if (error) throw error
      
      setDataList(data || [])
      console.log(`Fetched ${tableName}:`, data)
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error)
      alert(`Error fetching ${tableName}: ${error.message}`)
    } finally {
      setViewLoading(false)
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
          className={`tab-btn ${activeTab === 'booking' ? 'active' : ''}`}
          onClick={() => setActiveTab('booking')}
        >
          Booking
        </button>
        <button 
          className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveTab('view')}
        >
          View Data
        </button>
        <button 
          className={`tab-btn ${activeTab === 'districts' ? 'active' : ''}`}
          onClick={() => { setActiveTab('districts'); fetchTableData('district'); }}
        >
          Districts
        </button>
        <button 
          className={`tab-btn ${activeTab === 'destinations' ? 'active' : ''}`}
          onClick={() => { setActiveTab('destinations'); fetchTableData('destination'); }}
        >
          Destinations
        </button>
      </div>

      <main>
        {/* TOURIST REGISTER TAB */}
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
                <input 
                  type="text" 
                  name="tourist_id" 
                  className="form-input" 
                  value={touristForm.tourist_id}
                  onChange={handleTouristChange}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  name="name" 
                  className="form-input" 
                  value={touristForm.name}
                  onChange={handleTouristChange}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input 
                  type="text" 
                  name="phone" 
                  className="form-input" 
                  value={touristForm.phone}
                  onChange={handleTouristChange}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  name="email" 
                  className="form-input" 
                  value={touristForm.email}
                  onChange={handleTouristChange}
                />
              </div>
              <div className="form-group">
                <label>Nationality</label>
                <input 
                  type="text" 
                  name="nationality" 
                  className="form-input" 
                  value={touristForm.nationality}
                  onChange={handleTouristChange}
                />
              </div>
              <button type="submit" className="btn">Register Tourist</button>
            </form>
          </div>
        )}

        {/* BOOKING TAB */}
        {activeTab === 'booking' && (
          <div className="card">
            <h2>Process Booking</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Insert a new record into the <code style={{color: 'var(--accent)'}}>booking</code> table.
            </p>

            {bookingMsg.text && (
              <div className={`msg ${bookingMsg.type}`}>
                {bookingMsg.text}
              </div>
            )}

            <form onSubmit={handleBookingSubmit}>
              <div className="form-group">
                <label>Booking ID</label>
                <input 
                  type="text" 
                  name="booking_id" 
                  className="form-input" 
                  value={bookingForm.booking_id}
                  onChange={handleBookingChange}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Tourist ID</label>
                <input 
                  type="text" 
                  name="tourist_id" 
                  className="form-input" 
                  value={bookingForm.tourist_id}
                  onChange={handleBookingChange}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Package ID</label>
                <input 
                  type="text" 
                  name="package_id" 
                  className="form-input" 
                  value={bookingForm.package_id}
                  onChange={handleBookingChange}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Booking Date</label>
                <input 
                  type="date" 
                  name="booking_date" 
                  className="form-input" 
                  value={bookingForm.booking_date}
                  onChange={handleBookingChange}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Travel Date</label>
                <input 
                  type="date" 
                  name="travel_date" 
                  className="form-input" 
                  value={bookingForm.travel_date}
                  onChange={handleBookingChange}
                  required 
                />
              </div>
              <button type="submit" className="btn">Submit Booking</button>
            </form>
          </div>
        )}

        {/* VIEW DATA TAB */}
        {activeTab === 'view' && (
          <div className="card">
            <h2>Database Records</h2>
            <div className="data-section-controls">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => fetchTableData('tourist')}
              >
                Fetch Tourists
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => fetchTableData('booking')}
              >
                Fetch Bookings
              </button>
            </div>

            {viewLoading && <p>Loading data...</p>}
            
            {!viewLoading && currentView && (
              <div className="table-container">
                <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>
                  Table: {currentView}
                </h3>
                {dataList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No records found.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(dataList[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataList.map((row, index) => (
                        <tr key={index}>
                          {Object.values(row).map((val, i) => (
                            <td key={i}>{val !== null ? val.toString() : ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* DISTRICTS / DESTINATIONS CARDS VIEW */}
        {(activeTab === 'districts' || activeTab === 'destinations') && (
          <div className="card">
            <h2>{activeTab === 'districts' ? 'Districts' : 'Destinations'} Directory</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Fetched from <code style={{color: 'var(--accent)'}}>{activeTab === 'districts' ? 'district' : 'destination'}</code> table.
            </p>

            {viewLoading && <p>Loading data...</p>}
            
            {!viewLoading && (
              <div className="grid-cards">
                {dataList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No records found.</p>
                ) : (
                  dataList.map((item, idx) => (
                    <div className="data-card" key={idx}>
                      <div className="data-card-title">
                        {item.name || item.destination_name || item.district_name || item.title || `Record #${idx + 1}`}
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
          </div>
        )}
      </main>
    </div>
  )
}

export default App
