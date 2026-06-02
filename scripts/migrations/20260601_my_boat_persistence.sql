-- Cloud-synced My Boat data model.
ALTER TABLE boats ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS boat_type TEXT;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS beam_m NUMERIC;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS engine TEXT;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS home_marina TEXT;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE boats SET boat_type = COALESCE(boat_type, type);
UPDATE boats SET engine = COALESCE(engine, engine_type);

CREATE TABLE IF NOT EXISTS boat_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boat_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('insurance', 'registration', 'survey', 'mooring_contract', 'license', 'other')),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS refuel_date TIMESTAMP;
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
UPDATE fuel_logs SET location = COALESCE(location, location_name);
UPDATE fuel_logs SET refuel_date = COALESCE(refuel_date, logged_at);

ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
UPDATE maintenance_logs SET due_date = COALESCE(due_date, next_due_at);
UPDATE maintenance_logs SET completed_at = COALESCE(completed_at, done_at);

ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS departure_name TEXT;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS arrival_name TEXT;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS departure_lat NUMERIC;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS departure_lon NUMERIC;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS arrival_lat NUMERIC;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS arrival_lon NUMERIC;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS average_speed_knots NUMERIC;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS weather_summary TEXT;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE voyage_logs ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;
UPDATE voyage_logs SET departure_name = COALESCE(departure_name, from_name);
UPDATE voyage_logs SET arrival_name = COALESCE(arrival_name, to_name);
UPDATE voyage_logs SET departure_lat = COALESCE(departure_lat, from_lat);
UPDATE voyage_logs SET departure_lon = COALESCE(departure_lon, from_lon);
UPDATE voyage_logs SET arrival_lat = COALESCE(arrival_lat, to_lat);
UPDATE voyage_logs SET arrival_lon = COALESCE(arrival_lon, to_lon);
UPDATE voyage_logs SET duration_minutes = COALESCE(duration_minutes, (duration_hours * 60)::INTEGER);
UPDATE voyage_logs SET average_speed_knots = COALESCE(average_speed_knots, avg_speed_kn);
UPDATE voyage_logs SET started_at = COALESCE(started_at, departed_at);
UPDATE voyage_logs SET ended_at = COALESCE(ended_at, arrived_at);

CREATE TABLE IF NOT EXISTS boat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'boat_created',
    'photo_added',
    'document_added',
    'document_expiring',
    'fuel_added',
    'maintenance_created',
    'maintenance_completed',
    'voyage_started',
    'voyage_completed'
  )),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boat_photos_boat_id ON boat_photos(boat_id);
CREATE INDEX IF NOT EXISTS idx_boat_documents_boat_id ON boat_documents(boat_id);
CREATE INDEX IF NOT EXISTS idx_boat_events_boat_id ON boat_events(boat_id);
