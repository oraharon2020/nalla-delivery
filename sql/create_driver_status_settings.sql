-- Create driver_status_settings table
CREATE TABLE IF NOT EXISTS driver_status_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL,
  completion_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id, store_id)
);

-- Enable RLS
ALTER TABLE driver_status_settings ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Allow all for authenticated users" ON driver_status_settings
  FOR ALL USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_driver_status_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER driver_status_settings_updated_at
  BEFORE UPDATE ON driver_status_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_status_settings_updated_at();
