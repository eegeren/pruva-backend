const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('Migration starting...');
  const schema = fs.readFileSync('./scripts/schema.sql', 'utf8');
  await pool.query(schema);
  console.log('Migration completed');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS map_point_ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      map_point_id UUID NOT NULL REFERENCES map_points(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (map_point_id, user_id)
    )
  `);
  console.log('map_point_ratings table is ready');

  await pool.query(`
    INSERT INTO map_points (name, type, latitude, longitude, description, vhf_channel, depth_m, berth_count) VALUES
    ('Gocek Marina', 'marina', 36.7530, 28.9340, 'Full-service marina with 300-boat capacity', 'CH09', 4.5, 300),
    ('Marmaris Netsel Marina', 'marina', 36.8512, 28.2698, 'International marina with full services', 'CH09', 6.0, 750),
    ('Bodrum Milta Marina', 'marina', 37.0310, 27.4275, 'Central location with full facilities', 'CH09', 5.0, 400),
    ('D-Marin Turgutreis', 'marina', 37.0198, 27.2695, 'Modern marina facilities', 'CH09', 4.0, 500),
    ('Fethiye Marina', 'marina', 36.6521, 29.1062, 'Close to the city center', 'CH16', 3.5, 200),
    ('Gocek Fuel Dock', 'fuel', 36.7545, 28.9280, 'Diesel and gasoline, 07:00-20:00', null, null, null),
    ('Marmaris Fuel Dock', 'fuel', 36.8498, 28.2712, 'Diesel, 08:00-18:00', null, null, null),
    ('Bodrum Fuel Dock', 'fuel', 37.0332, 27.4298, 'Diesel and gasoline', null, null, null),
    ('Kas Fuel Dock', 'fuel', 36.2021, 29.6445, 'Diesel, limited stock', null, null, null),
    ('Marmaris Shipyard', 'service', 36.8476, 28.2654, 'Boat maintenance, repairs, travelift', null, null, null),
    ('Bodrum Boatyard', 'service', 37.0298, 27.4187, 'Winter storage and maintenance services', null, null, null),
    ('Gocek Shipyard', 'service', 36.7489, 28.9198, 'Private maintenance services', null, null, null),
    ('Fethiye Shipyard', 'service', 36.6487, 29.0987, 'Boat repairs and maintenance', null, null, null)
    ON CONFLICT DO NOTHING;
  `);
  console.log('map_points seed inserted');
  
  console.log('Seed starting...');
  const seed = fs.readFileSync('./scripts/seed.sql', 'utf8');
  await pool.query(seed);
  console.log('Seed completed');
  
  await pool.end();
}

migrate().catch(console.error);

async function updateConstraints() {
  console.log('Updating constraint...');
  await pool.query(`
    ALTER TABLE map_points DROP CONSTRAINT IF EXISTS map_points_type_check;
    ALTER TABLE map_points ADD CONSTRAINT map_points_type_check 
    CHECK (type IN ('marina', 'fuel', 'service', 'water', 'customs', 'emergency', 'restaurant', 'beach', 'diving'));
  `);
  console.log('Constraint updated');
}

async function addProfileColumns() {
  console.log('Adding profile columns...');
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT '#0077B6';
  `);
  console.log('Profile columns added');
}
