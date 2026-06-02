const db = require('../config/db');

let ensured = false;

async function ensureMarinePOITables() {
  if (ensured) return;

  await db.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  `);

  ensured = true;
}

module.exports = { ensureMarinePOITables };

