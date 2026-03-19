-- Activity logs table - tracks all driver actions
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  action TEXT NOT NULL, -- 'status_change', 'note_added', 'file_uploaded', 'signature_submitted', 'login'
  order_id TEXT,
  order_number TEXT,
  store_id TEXT,
  details JSONB DEFAULT '{}', -- flexible payload: {from_status, to_status, note_text, file_name, etc.}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quick lookups
CREATE INDEX idx_activity_logs_driver ON activity_logs(driver_id);
CREATE INDEX idx_activity_logs_date ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_order ON activity_logs(order_id);

-- RLS policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users" ON activity_logs
  FOR ALL USING (true) WITH CHECK (true);
