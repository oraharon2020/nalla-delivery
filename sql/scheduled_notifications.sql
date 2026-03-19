-- Scheduled notification templates
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target TEXT DEFAULT 'all', -- 'all', 'drivers', 'admins'
  url TEXT,
  schedule_type TEXT NOT NULL, -- 'daily', 'weekly', 'one_time'
  schedule_time TIME NOT NULL, -- e.g. '08:00'
  schedule_days INTEGER[] DEFAULT '{}', -- for weekly: 0=Sun,1=Mon...6=Sat
  one_time_date DATE, -- for one_time only
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_sched_notif_active ON scheduled_notifications(is_active);
