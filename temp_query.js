import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data, error } = await supabase.from('package').select('*').limit(1)
  console.log("Package structure:", data)
  
  const { data: bData, error: bError } = await supabase.from('booking').select('*').limit(1)
  console.log("Booking structure:", bData)
}

run()
