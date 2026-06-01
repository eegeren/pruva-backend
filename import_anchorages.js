const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/maviyol'
});

async function importAnchorages() {
  console.log('📂 JSON okunuyor...');
  const raw = fs.readFileSync('anchorages_world.json', 'utf8');
  const data = JSON.parse(raw);
  const nodes = data.elements;
  console.log(`🌍 Toplam ${nodes.length} koy bulundu`);

  let imported = 0;
  let skipped = 0;

  for (const node of nodes) {
    const { lat, lon, tags = {} } = node;
    if (!lat || !lon) { skipped++; continue; }

    const name = tags.name || tags['name:tr'] || tags['name:en'] || `Koy ${node.id}`;
    const depth = tags['seamark:anchorage:depth'] || tags['depth'] || null;
    const bottomType = normalizeBottomType(tags['seamark:anchorage:bottom'] || tags['bottom'] || null);
    const description = tags['description'] || null;

    try {
      await pool.query(
        `INSERT INTO anchorages (name, latitude, longitude, depth, bottom_type, description)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [name, lat, lon, depth ? parseFloat(depth) : null, bottomType, description]
      );
      imported++;
    } catch (err) {
      skipped++;
    }

    if (imported % 200 === 0 && imported > 0) {
      console.log(`✅ ${imported} / ${nodes.length} aktarıldı...`);
    }
  }

  console.log(`\n🎉 Tamamlandı! Aktarılan: ${imported}, Atlanan: ${skipped}`);
  await pool.end();
}

function normalizeBottomType(value) {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v.includes('sand')) return 'sand';
  if (v.includes('rock')) return 'rock';
  if (v.includes('mud'))  return 'mud';
  if (v.includes('weed')) return 'weed';
  return null;
}

importAnchorages().catch(console.error);
