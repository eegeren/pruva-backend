-- Pro+ backend draft migration (MVP + Phase 2 foundations)

CREATE TABLE IF NOT EXISTS captain_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  evidence_url TEXT,
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS pro_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION,
  distance_nm DOUBLE PRECISION,
  duration_hours DOUBLE PRECISION,
  preference VARCHAR(32) NOT NULL DEFAULT 'safest' CHECK (preference IN ('safest', 'shortest', 'fuel_efficient')),
  risk_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_segment_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES pro_routes(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  from_lat DOUBLE PRECISION,
  from_lon DOUBLE PRECISION,
  to_lat DOUBLE PRECISION,
  to_lon DOUBLE PRECISION,
  distance_nm DOUBLE PRECISION,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (route_id, segment_index)
);

CREATE TABLE IF NOT EXISTS weather_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  observed_at TIMESTAMP NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'openweather',
  wind_kn DOUBLE PRECISION,
  gust_kn DOUBLE PRECISION,
  wave_m DOUBLE PRECISION,
  current_kn DOUBLE PRECISION,
  visibility_nm DOUBLE PRECISION,
  pressure_hpa DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anchorage_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchorage_id UUID NOT NULL REFERENCES anchorages(id) ON DELETE CASCADE,
  best_anchor_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  similar_anchorages JSONB NOT NULL DEFAULT '[]'::jsonb,
  crowd_score DOUBLE PRECISION,
  risk_score DOUBLE PRECISION,
  computed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crowd_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchorage_id UUID NOT NULL REFERENCES anchorages(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  expected_boats INTEGER NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  model_version VARCHAR(32),
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (anchorage_id, day_of_week, hour_of_day)
);

CREATE TABLE IF NOT EXISTS fuel_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boat_type VARCHAR(64),
  cruise_speed_kn DOUBLE PRECISION NOT NULL,
  burn_rate_lph DOUBLE PRECISION NOT NULL,
  fuel_price_per_l DOUBLE PRECISION NOT NULL,
  reserve_pct DOUBLE PRECISION NOT NULL DEFAULT 20,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS cost_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id UUID REFERENCES pro_routes(id) ON DELETE SET NULL,
  distance_nm DOUBLE PRECISION,
  eta_hours DOUBLE PRECISION,
  avg_wind_kn DOUBLE PRECISION,
  avg_wave_m DOUBLE PRECISION,
  weather_penalty DOUBLE PRECISION,
  estimated_fuel_l DOUBLE PRECISION NOT NULL,
  estimated_cost DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  threshold JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  type VARCHAR(40) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedup_key VARCHAR(255),
  triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS private_logbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  note TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  weather JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  logged_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_changes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stream VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  operation VARCHAR(16) NOT NULL CHECK (operation IN ('upsert', 'delete')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_sync_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(128) NOT NULL,
  last_cursor TIMESTAMP NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64),
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_user_created ON pro_routes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_segment_route ON route_segment_risks(route_id, segment_index);
CREATE INDEX IF NOT EXISTS idx_weather_location_time ON weather_snapshots(lat, lon, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_anchorage_intel_anchor_time ON anchorage_intelligence(anchorage_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_crowd_forecast_anchor ON crowd_forecasts(anchorage_id, day_of_week, hour_of_day);
CREATE INDEX IF NOT EXISTS idx_alert_rule_user_active ON alert_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alert_event_user_time ON alert_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_user_time ON private_logbook_entries(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_change_user_time ON sync_changes(user_id, changed_at ASC);
