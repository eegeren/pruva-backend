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

-- Tekne profili
CREATE TABLE IF NOT EXISTS boats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),        -- yelkenli, motor, gulet
  length_m DOUBLE PRECISION,
  draft_m DOUBLE PRECISION, -- su altı derinliği
  fuel_capacity_l DOUBLE PRECISION,
  engine_type VARCHAR(100),
  registration_no VARCHAR(100),
  insurance_expires_at DATE,
  registration_expires_at DATE,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Yakıt takibi
CREATE TABLE IF NOT EXISTS fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  liters DOUBLE PRECISION NOT NULL,
  price_per_liter DOUBLE PRECISION,
  total_cost DOUBLE PRECISION,
  location_name VARCHAR(255),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  engine_hours DOUBLE PRECISION,
  notes TEXT,
  logged_at TIMESTAMP DEFAULT NOW()
);

-- Bağlama yeri
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

-- Bakım kayıtları
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),     -- motor, tekne, elektrik, yelken
  description TEXT,
  cost DOUBLE PRECISION,
  engine_hours DOUBLE PRECISION,
  done_at DATE NOT NULL,
  next_due_at DATE,
  reminder_days INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seyir günlüğü
CREATE TABLE IF NOT EXISTS voyage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  from_name VARCHAR(255),
  to_name VARCHAR(255),
  from_lat DOUBLE PRECISION,
  from_lon DOUBLE PRECISION,
  to_lat DOUBLE PRECISION,
  to_lon DOUBLE PRECISION,
  distance_nm DOUBLE PRECISION,
  duration_hours DOUBLE PRECISION,
  avg_speed_kn DOUBLE PRECISION,
  max_speed_kn DOUBLE PRECISION,
  wind_avg_kn DOUBLE PRECISION,
  wave_height_m DOUBLE PRECISION,
  fuel_used_l DOUBLE PRECISION,
  crew_count INTEGER,
  notes TEXT,
  departed_at TIMESTAMP,
  arrived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Harita işaretlemeleri
CREATE TABLE IF NOT EXISTS map_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('marina', 'fuel', 'service')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  description TEXT,
  phone VARCHAR(50),
  website VARCHAR(255),
  vhf_channel VARCHAR(10),
  fuel_types TEXT[],        -- diesel, petrol
  depth_m DOUBLE PRECISION, -- marina giriş derinliği
  berth_count INTEGER,      -- marina tekne kapasitesi
  opening_hours VARCHAR(255),
  rating DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_points_location ON map_points(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_map_points_type ON map_points(type);
