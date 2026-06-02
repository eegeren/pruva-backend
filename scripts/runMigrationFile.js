require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function main() {
  const file = process.argv[2];
  if (!file) {
    throw new Error('Usage: node scripts/runMigrationFile.js scripts/migrations/file.sql');
  }

  const fullPath = path.resolve(process.cwd(), file);
  const sql = fs.readFileSync(fullPath, 'utf8');
  console.log(`Running migration file: ${file}`);
  await db.query(sql);
  console.log('Migration file completed');
}

main()
  .catch((err) => {
    console.error('Migration file failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });

