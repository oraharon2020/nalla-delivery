-- Driver live locations table
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- Index for quick lookups
CREATE INDEX idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_online ON driver_locations(is_online);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;

-- RLS policies
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users" ON driver_locations
  FOR ALL USING (true) WITH CHECK (true);
