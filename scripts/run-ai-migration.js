require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const files = [
    '20260525_map_point_ai_enrichment.sql',
    '20260526_map_point_ai_reviews.sql',
  ];
  for (const file of files) {
    const sqlPath = path.join(__dirname, 'migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log(`✅ ${file}`);
  }
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
