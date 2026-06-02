CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bottom_type_enum') THEN
    CREATE TYPE bottom_type_enum AS ENUM ('sand', 'rock', 'mud', 'weed');
  END IF;
END$$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT '#0077B6';

-- Anchorages
CREATE TABLE IF NOT EXISTS anchorages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  depth DOUBLE PRECISION,
  bottom_type bottom_type_enum,
  rating DOUBLE PRECISION DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchorage_id UUID REFERENCES anchorages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  text TEXT NOT NULL,
  depth_observed DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Community check-ins
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  anchorage_id UUID REFERENCES anchorages(id) ON DELETE CASCADE,
  boat_name VARCHAR(255),
  note TEXT,
  depth_observed DOUBLE PRECISION,
  wave_height DOUBLE PRECISION,
  wind_speed DOUBLE PRECISION,
  bottom_quality INTEGER CHECK (bottom_quality BETWEEN 1 AND 5),
  is_current BOOLEAN DEFAULT TRUE,
  arrived_at TIMESTAMP DEFAULT NOW(),
  departed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anchorage_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchorage_id UUID REFERENCES anchorages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Saved anchorages
CREATE TABLE IF NOT EXISTS saved_anchorages (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  anchorage_id UUID REFERENCES anchorages(id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anchorage_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anchorages_location ON anchorages(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_comments_anchorage ON comments(anchorage_id);
CREATE INDEX IF NOT EXISTS idx_checkins_anchorage ON checkins(anchorage_id);
CREATE INDEX IF NOT EXISTS idx_checkins_current ON checkins(anchorage_id, is_current);

-- Boat profiles
CREATE TABLE IF NOT EXISTS boats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  boat_type TEXT,
  manufacturer VARCHAR(160),
  model VARCHAR(160),
  length_m DOUBLE PRECISION,
  beam_m DOUBLE PRECISION,
  draft_m DOUBLE PRECISION,
  fuel_capacity_l DOUBLE PRECISION,
  engine_type VARCHAR(100),
  engine TEXT,
  registration_no VARCHAR(100),
  insurance_expires_at DATE,
  registration_expires_at DATE,
  home_marina VARCHAR(255),
  country VARCHAR(120),
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Fuel tracking
CREATE TABLE IF NOT EXISTS fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  liters DOUBLE PRECISION NOT NULL,
  price_per_liter DOUBLE PRECISION,
  total_cost DOUBLE PRECISION,
  currency TEXT DEFAULT 'EUR',
  location_name VARCHAR(255),
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  engine_hours DOUBLE PRECISION,
  notes TEXT,
  logged_at TIMESTAMP DEFAULT NOW(),
  refuel_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Moorings
CREATE TABLE IF NOT EXISTS moorings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  marina_name VARCHAR(255) NOT NULL,
  pontoon VARCHAR(50),
  berth_no VARCHAR(50),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  monthly_fee DOUBLE PRECISION,
  currency VARCHAR(10) DEFAULT 'TRY',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  photo_url TEXT,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance logs
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  cost DOUBLE PRECISION,
  currency TEXT DEFAULT 'EUR',
  engine_hours DOUBLE PRECISION,
  done_at DATE NOT NULL,
  next_due_at DATE,
  reminder_days INTEGER DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Voyage logs
CREATE TABLE IF NOT EXISTS voyage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  from_name VARCHAR(255),
  to_name VARCHAR(255),
  departure_name TEXT,
  arrival_name TEXT,
  from_lat DOUBLE PRECISION,
  from_lon DOUBLE PRECISION,
  to_lat DOUBLE PRECISION,
  to_lon DOUBLE PRECISION,
  departure_lat NUMERIC,
  departure_lon NUMERIC,
  arrival_lat NUMERIC,
  arrival_lon NUMERIC,
  distance_nm DOUBLE PRECISION,
  duration_hours DOUBLE PRECISION,
  duration_minutes INTEGER,
  avg_speed_kn DOUBLE PRECISION,
  average_speed_knots NUMERIC,
  max_speed_kn DOUBLE PRECISION,
  wind_avg_kn DOUBLE PRECISION,
  wave_height_m DOUBLE PRECISION,
  fuel_used_l DOUBLE PRECISION,
  weather_summary TEXT,
  crew_count INTEGER,
  notes TEXT,
  departed_at TIMESTAMP,
  arrived_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Map points
CREATE TABLE IF NOT EXISTS map_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('marina', 'fuel', 'service', 'water', 'customs', 'emergency', 'restaurant', 'beach', 'diving')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  description TEXT,
  phone VARCHAR(50),
  website VARCHAR(255),
  vhf_channel VARCHAR(10),
  fuel_types TEXT[],
  depth_m DOUBLE PRECISION,
  berth_count INTEGER,
  opening_hours VARCHAR(255),
  amenities TEXT,
  ai_summary TEXT,
  enriched_at TIMESTAMP,
  rating DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_points_location ON map_points(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_map_points_type ON map_points(type);

-- Global marine POIs imported from OSM/OpenSeaMap via Overpass
CREATE TABLE IF NOT EXISTS marine_pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT DEFAULT 'osm',
  source_id TEXT,
  osm_type TEXT,
  osm_id BIGINT,
  type TEXT NOT NULL,
  name TEXT,
  normalized_name TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  country TEXT,
  region TEXT,
  city TEXT,
  address TEXT,
  tags JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  ai_summary TEXT,
  rating NUMERIC,
  review_count INTEGER,
  phone TEXT,
  website TEXT,
  vhf_channel TEXT,
  opening_hours TEXT,
  entrance_depth_m NUMERIC,
  berth_capacity INTEGER,
  fuel_types TEXT[],
  facilities TEXT[],
  price_range TEXT,
  holding_type TEXT,
  seabed_type TEXT,
  shelter_quality TEXT,
  depth_min_m NUMERIC,
  depth_max_m NUMERIC,
  source_updated_at TIMESTAMP,
  imported_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (source, osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS idx_marine_pois_type ON marine_pois(type);
CREATE INDEX IF NOT EXISTS idx_marine_pois_country ON marine_pois(country);
CREATE INDEX IF NOT EXISTS idx_marine_pois_region ON marine_pois(region);
CREATE INDEX IF NOT EXISTS idx_marine_pois_source_id ON marine_pois(source_id);
CREATE INDEX IF NOT EXISTS idx_marine_pois_location ON marine_pois(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_marine_pois_normalized_name ON marine_pois(normalized_name);

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_name TEXT,
  bbox JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  total_imported INTEGER DEFAULT 0,
  total_updated INTEGER DEFAULT 0,
  error TEXT
);
