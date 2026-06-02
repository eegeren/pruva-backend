require('dotenv').config();

const db = require('../src/config/db');
const {
  importBoundingBox,
  importRegion,
  importWorldwideInTiles,
} = require('../src/services/overpassMarineImporter');

async function main() {
  const command = process.argv[2] || 'turkey_coast';
  console.log(`Marine POI import starting: ${command}`);

  let result;
  if (command === 'world') {
    result = await importWorldwideInTiles();
  } else if (command === 'bbox') {
    const [minLat, minLon, maxLat, maxLon] = process.argv.slice(3).map(Number);
    if ([minLat, minLon, maxLat, maxLon].some((value) => !Number.isFinite(value))) {
      throw new Error('Usage: node scripts/importMarinePOIs.js bbox minLat minLon maxLat maxLon');
    }
    result = await importBoundingBox(minLat, minLon, maxLat, maxLon, { regionName: 'cli_bbox' });
  } else {
    result = await importRegion(command);
  }

  console.log('Marine POI import completed');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error('Marine POI import failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });

