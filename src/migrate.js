const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('🔄 Migration başlıyor...');
  const schema = fs.readFileSync('./scripts/schema.sql', 'utf8');
  await pool.query(schema);
  console.log('✅ Migration tamamlandı');

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
  console.log('✅ map_point_ratings tablosu hazır');

  await pool.query(`
    INSERT INTO map_points (name, type, latitude, longitude, description, vhf_channel, depth_m, berth_count) VALUES
    ('Göcek Marina', 'marina', 36.7530, 28.9340, 'Tam hizmet marina, 300 tekne kapasiteli', 'CH09', 4.5, 300),
    ('Marmaris Netsel Marina', 'marina', 36.8512, 28.2698, 'Uluslararası marina, tüm hizmetler', 'CH09', 6.0, 750),
    ('Bodrum Milta Marina', 'marina', 37.0310, 27.4275, 'Merkezi konumda, tam donanımlı', 'CH09', 5.0, 400),
    ('D-Marin Turgutreis', 'marina', 37.0198, 27.2695, 'Modern marina tesisleri', 'CH09', 4.0, 500),
    ('Fethiye Marina', 'marina', 36.6521, 29.1062, 'Şehir merkezine yakın', 'CH16', 3.5, 200),
    ('Göcek Yakıt', 'fuel', 36.7545, 28.9280, 'Dizel ve benzin, 07:00-20:00', null, null, null),
    ('Marmaris Yakıt İskelesi', 'fuel', 36.8498, 28.2712, 'Dizel, 08:00-18:00', null, null, null),
    ('Bodrum Yakıt', 'fuel', 37.0332, 27.4298, 'Dizel ve benzin', null, null, null),
    ('Kaş Yakıt', 'fuel', 36.2021, 29.6445, 'Dizel, sınırlı stok', null, null, null),
    ('Marmaris Tersanesi', 'service', 36.8476, 28.2654, 'Tekne bakım, onarım, travelift', null, null, null),
    ('Bodrum Çekek Yeri', 'service', 37.0298, 27.4187, 'Kışlık çekek, bakım hizmetleri', null, null, null),
    ('Göcek Shipyard', 'service', 36.7489, 28.9198, 'Osmanlı tersanesi, özel bakım', null, null, null),
    ('Fethiye Tersane', 'service', 36.6487, 29.0987, 'Tekne tamiri ve bakımı', null, null, null)
    ON CONFLICT DO NOTHING;
  `);
  console.log('✅ map_points seed eklendi');
  
  console.log('🌱 Seed başlıyor...');
  const seed = fs.readFileSync('./scripts/seed.sql', 'utf8');
  await pool.query(seed);
  console.log('✅ Seed tamamlandı');
  
  await pool.end();
}

migrate().catch(console.error);

async function updateConstraints() {
  console.log('🔄 Constraint güncelleniyor...');
  await pool.query(`
    ALTER TABLE map_points DROP CONSTRAINT IF EXISTS map_points_type_check;
    ALTER TABLE map_points ADD CONSTRAINT map_points_type_check 
    CHECK (type IN ('marina', 'fuel', 'service', 'water', 'customs', 'emergency', 'restaurant', 'beach', 'diving'));
  `);
  console.log('✅ Constraint güncellendi');
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
