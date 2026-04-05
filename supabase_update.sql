-- 1. Add Guide, Plan, and Ratings fields to the Package table
ALTER TABLE package ADD COLUMN IF NOT EXISTS guide_name TEXT;
ALTER TABLE package ADD COLUMN IF NOT EXISTS itinerary TEXT;
ALTER TABLE package ADD COLUMN IF NOT EXISTS ratings_count INTEGER DEFAULT 0;
ALTER TABLE package ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3, 2) DEFAULT 0.0;

-- 2. Create the Reviews table
CREATE TABLE IF NOT EXISTS review (
  review_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id TEXT, -- Use UUID if your package_id is a UUID instead of a text ID
  tourist_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. INPUT VALUES (Mock Data)
-- Update existing packages with dummy guide names, ratings, and itineraries
-- Note: These updates will apply to ALL packages right now just to give you data to see. 
-- You can modify the WHERE clause to target specific packages if you prefer.

UPDATE package 
SET 
  guide_name = 'Ramesh Kumar - Certified Kerala Tourism Guide',
  ratings_count = 124,
  avg_rating = 4.8,
  itinerary = 'Day 1: Arrival and Welcome Dinner. Check-in to hotel and relax. | Day 2: Morning sightseeing tour followed by a cultural show in the evening. | Day 3: Excursion to nearby attractions and local shopping. | Day 4: Departure after breakfast.'
WHERE guide_name IS NULL;

-- Insert some dummy reviews (You may need to change 'PKG001' to whatever an actual package_id in your database is)
-- To see reviews for a specific package, copy a real package_id from your package table.
-- INSERT INTO review (package_id, tourist_name, rating, comment) VALUES 
--  ('PKG001', 'Anjali Sharma', 5, 'Absolutely breathtaking views and perfect arrangements! Our guide Ramesh was very knowledgeable.'),
--  ('PKG001', 'David Smith', 4, 'Great package overall. The hotel was fantastic but the travel took a bit longer than expected.');
