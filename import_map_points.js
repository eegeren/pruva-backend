const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const files = [
  { file: 'marinas_world.json',  type: 'marina' },
  { file: 'fuel_world2.json',    type: 'fuel' },
  { file: 'service_world.json',  type: 'service' },
  { file: 'diving_world.json',   type: 'diving' },
];

async function importAll() {
  for (const { file, type } of files) {
    if (!fs.existsSync(file)) { console.log(`${file} bulunamadı, atlanıyor`); continue; }
    
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const nodes = data.elements || [];
    console.log(`\n📂 ${file} → ${nodes.length} nokta`);

    let imported = 0, skipped = 0;

    for (const node of nodes) {
      const { lat, lon, tags = {} } = node;
      if (!lat || !lon) { skipped++; continue; }

      const name = tags.name || tags['name:en'] || tags['name:tr'] || `${type} ${node.id}`;
      const description = tags.description || tags['seamark:information'] || null;
      const phone = tags.phone || tags['contact:phone'] || null;
      const website = tags.website || tags['contact:website'] || null;
      const openingHours = tags.opening_hours || null;
      const vhfChannel = tags['seamark:radio_calling_in_point:channel'] || null;
      const depthM = tags['seamark:anchorage:depth'] ? parseFloat(tags['seamark:anchorage:depth']) : null;

      try {
        await pool.query(
          `INSERT INTO map_points (name, type, latitude, longitude, description, phone, website, opening_hours, vhf_channel, depth_m)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT DO NOTHING`,
          [name, type, lat, lon, description, phone, website, openingHours, vhfChannel, depthM]
        );
        imported++;
      } catch (err) {
        skipped++;
      }

      if (imported % 500 === 0 && imported > 0) {
        console.log(`  ✅ ${imported} / ${nodes.length}`);
      }
    }
    console.log(`  🎉 ${file}: ${imported} aktarıldı, ${skipped} atlandı`);
  }

  await pool.end();
  console.log('\n✅ Tüm veriler aktarıldı!');
}

importAll().catch(console.error);
