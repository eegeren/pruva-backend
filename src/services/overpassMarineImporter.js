const fetch = require('node-fetch');
const db = require('../config/db');
const { normalizeOSMElement } = require('./marinePOINormalizer');
const { enrichMarinePOI } = require('./marinePOIEnrichmentService');
const { generateSummary, isConfigured: isGeminiConfigured } = require('./geminiMarinePOIEnricher');
const { ensureMarinePOITables } = require('./marinePOISchema');

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

const REGIONS = {
  turkey_coast: { minLat: 35.7, minLon: 25.5, maxLat: 42.2, maxLon: 36.9 },
  aegean: { minLat: 35.0, minLon: 22.0, maxLat: 41.5, maxLon: 30.5 },
  mediterranean: { minLat: 30.0, minLon: -6.5, maxLat: 46.5, maxLon: 36.9 },
  europe_coast: { minLat: 35.0, minLon: -11.0, maxLat: 60.5, maxLon: 31.5 },
  greece: { minLat: 34.5, minLon: 19.0, maxLat: 42.0, maxLon: 29.8 },
  italy: { minLat: 35.0, minLon: 6.0, maxLat: 47.5, maxLon: 19.0 },
  croatia: { minLat: 42.0, minLon: 13.0, maxLat: 46.8, maxLon: 19.6 },
  spain: { minLat: 35.0, minLon: -10.0, maxLat: 44.5, maxLon: 5.0 },
  france: { minLat: 41.0, minLon: -5.8, maxLat: 51.5, maxLon: 9.6 },
  caribbean: { minLat: 9.0, minLon: -86.0, maxLat: 27.0, maxLon: -58.0 },
};

function bboxString(bbox) {
  return `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
}

function buildOverpassQuery(bbox) {
  const box = bboxString(bbox);
  return `
[out:json][timeout:60];
(
  node["leisure"="marina"](${box});
  way["leisure"="marina"](${box});
  relation["leisure"="marina"](${box});
  node["harbour"="marina"](${box});
  way["harbour"="marina"](${box});
  relation["harbour"="marina"](${box});
  node["seamark:type"="harbour"](${box});
  way["seamark:type"="harbour"](${box});
  relation["seamark:type"="harbour"](${box});
  node["seamark:harbour:category"="marina"](${box});
  way["seamark:harbour:category"="marina"](${box});
  relation["seamark:harbour:category"="marina"](${box});
  node["seamark:type"="small_craft_facility"](${box});
  way["seamark:type"="small_craft_facility"](${box});
  relation["seamark:type"="small_craft_facility"](${box});
  node["seamark:type"="anchorage"](${box});
  way["seamark:type"="anchorage"](${box});
  relation["seamark:type"="anchorage"](${box});
  node["anchorage"](${box});
  way["anchorage"](${box});
  relation["anchorage"](${box});
  node["mooring"](${box});
  way["mooring"](${box});
  relation["mooring"](${box});
  node["natural"="bay"](${box});
  way["natural"="bay"](${box});
  relation["natural"="bay"](${box});
  node["place"="bay"](${box});
  way["place"="bay"](${box});
  relation["place"="bay"](${box});
  node["seamark:small_craft_facility:category"="fuel_station"](${box});
  way["seamark:small_craft_facility:category"="fuel_station"](${box});
  relation["seamark:small_craft_facility:category"="fuel_station"](${box});
  node["seamark:type"="bunker_station"](${box});
  way["seamark:type"="bunker_station"](${box});
  relation["seamark:type"="bunker_station"](${box});
  node["waterway"="fuel"](${box});
  way["waterway"="fuel"](${box});
  relation["waterway"="fuel"](${box});
  node["amenity"="fuel"](${box});
  way["amenity"="fuel"](${box});
  node["boat:repair"="yes"](${box});
  way["boat:repair"="yes"](${box});
  node["shop"="boat"](${box});
  way["shop"="boat"](${box});
  node["craft"="boatbuilder"](${box});
  way["craft"="boatbuilder"](${box});
  node["industrial"="shipyard"](${box});
  way["industrial"="shipyard"](${box});
  node["sport"="scuba_diving"](${box});
  way["sport"="scuba_diving"](${box});
  node["diving"](${box});
  way["diving"](${box});
);
out center tags;
`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tileRegion(bbox, stepDegrees = 2) {
  const tiles = [];
  for (let minLat = bbox.minLat; minLat < bbox.maxLat; minLat += stepDegrees) {
    for (let minLon = bbox.minLon; minLon < bbox.maxLon; minLon += stepDegrees) {
      tiles.push({
        minLat,
        minLon,
        maxLat: Math.min(minLat + stepDegrees, bbox.maxLat),
        maxLon: Math.min(minLon + stepDegrees, bbox.maxLon),
      });
    }
  }
  return tiles;
}

async function fetchOverpass(bbox, attempt = 1) {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Accept: 'application/json',
      'User-Agent': 'PruvaMarineImporter/1.0 (contact: support@pruva.app)',
    },
    body: buildOverpassQuery(bbox),
  });

  if (!response.ok) {
    if (attempt < 2) {
      await sleep(1500);
      return fetchOverpass(bbox, attempt + 1);
    }
    const text = await response.text();
    throw new Error(`Overpass ${response.status}: ${text.slice(0, 300)}`);
  }

  return response.json();
}

async function findDuplicate(poi) {
  const named = poi.normalized_name
    ? await db.query(
        `SELECT id, tags, facilities, fuel_types
         FROM marine_pois
         WHERE type = $1
           AND normalized_name = $2
           AND ABS(latitude - $3) <= 0.001
           AND ABS(longitude - $4) <= 0.001
         LIMIT 1`,
        [poi.type, poi.normalized_name, poi.latitude, poi.longitude]
      )
    : { rows: [] };

  if (named.rows[0]) return named.rows[0];

  const unnamed = await db.query(
    `SELECT id, tags, facilities, fuel_types
     FROM marine_pois
     WHERE type = $1
       AND normalized_name IS NULL
       AND ABS(latitude - $2) <= 0.0005
       AND ABS(longitude - $3) <= 0.0005
     LIMIT 1`,
    [poi.type, poi.latitude, poi.longitude]
  );
  return unnamed.rows[0] || null;
}

function mergeArrays(a, b) {
  const values = [...(a || []), ...(b || [])].map((item) => String(item).trim()).filter(Boolean);
  return values.length ? [...new Set(values)] : null;
}

async function upsertPOI(poi) {
  const duplicate = await findDuplicate(poi);
  if (duplicate && duplicate.id) {
    await db.query(
      `UPDATE marine_pois
       SET tags = COALESCE(tags, '{}'::jsonb) || $2::jsonb,
           facilities = $3,
           fuel_types = $4,
           description = COALESCE(description, $5),
           ai_summary = COALESCE(ai_summary, $6),
           updated_at = NOW()
       WHERE id = $1`,
      [
        duplicate.id,
        JSON.stringify(poi.tags || {}),
        mergeArrays(duplicate.facilities, poi.facilities),
        mergeArrays(duplicate.fuel_types, poi.fuel_types),
        poi.description,
        poi.ai_summary,
      ]
    );
    return 'updated';
  }

  const result = await db.query(
    `INSERT INTO marine_pois (
      source, source_id, osm_type, osm_id, type, name, normalized_name,
      latitude, longitude, country, region, city, address, tags, description,
      ai_summary, rating, review_count, phone, website, vhf_channel, opening_hours,
      entrance_depth_m, berth_capacity, fuel_types, facilities, price_range,
      holding_type, seabed_type, shelter_quality, depth_min_m, depth_max_m,
      source_updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14::jsonb, $15,
      $16, $17, $18, $19, $20, $21, $22,
      $23, $24, $25, $26, $27,
      $28, $29, $30, $31, $32,
      $33
    )
    ON CONFLICT (source, osm_type, osm_id)
    DO UPDATE SET
      type = EXCLUDED.type,
      name = COALESCE(EXCLUDED.name, marine_pois.name),
      normalized_name = COALESCE(EXCLUDED.normalized_name, marine_pois.normalized_name),
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      country = COALESCE(EXCLUDED.country, marine_pois.country),
      region = COALESCE(EXCLUDED.region, marine_pois.region),
      city = COALESCE(EXCLUDED.city, marine_pois.city),
      address = COALESCE(EXCLUDED.address, marine_pois.address),
      tags = COALESCE(marine_pois.tags, '{}'::jsonb) || EXCLUDED.tags,
      description = COALESCE(EXCLUDED.description, marine_pois.description),
      ai_summary = COALESCE(marine_pois.ai_summary, EXCLUDED.ai_summary),
      phone = COALESCE(EXCLUDED.phone, marine_pois.phone),
      website = COALESCE(EXCLUDED.website, marine_pois.website),
      vhf_channel = COALESCE(EXCLUDED.vhf_channel, marine_pois.vhf_channel),
      opening_hours = COALESCE(EXCLUDED.opening_hours, marine_pois.opening_hours),
      entrance_depth_m = COALESCE(EXCLUDED.entrance_depth_m, marine_pois.entrance_depth_m),
      berth_capacity = COALESCE(EXCLUDED.berth_capacity, marine_pois.berth_capacity),
      fuel_types = COALESCE(EXCLUDED.fuel_types, marine_pois.fuel_types),
      facilities = COALESCE(EXCLUDED.facilities, marine_pois.facilities),
      price_range = COALESCE(EXCLUDED.price_range, marine_pois.price_range),
      holding_type = COALESCE(EXCLUDED.holding_type, marine_pois.holding_type),
      seabed_type = COALESCE(EXCLUDED.seabed_type, marine_pois.seabed_type),
      shelter_quality = COALESCE(EXCLUDED.shelter_quality, marine_pois.shelter_quality),
      depth_min_m = COALESCE(EXCLUDED.depth_min_m, marine_pois.depth_min_m),
      depth_max_m = COALESCE(EXCLUDED.depth_max_m, marine_pois.depth_max_m),
      source_updated_at = COALESCE(EXCLUDED.source_updated_at, marine_pois.source_updated_at),
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted`,
    [
      poi.source,
      poi.source_id,
      poi.osm_type,
      poi.osm_id,
      poi.type,
      poi.name,
      poi.normalized_name,
      poi.latitude,
      poi.longitude,
      poi.country,
      poi.region,
      poi.city,
      poi.address,
      JSON.stringify(poi.tags || {}),
      poi.description,
      poi.ai_summary,
      poi.rating ?? null,
      poi.review_count ?? null,
      poi.phone,
      poi.website,
      poi.vhf_channel,
      poi.opening_hours,
      poi.entrance_depth_m,
      poi.berth_capacity,
      poi.fuel_types,
      poi.facilities,
      poi.price_range,
      poi.holding_type,
      poi.seabed_type,
      poi.shelter_quality,
      poi.depth_min_m,
      poi.depth_max_m,
      poi.source_updated_at,
    ]
  );
  return result.rows[0]?.inserted ? 'inserted' : 'updated';
}

async function createJob(regionName, bbox) {
  const result = await db.query(
    `INSERT INTO import_jobs (region_name, bbox, status)
     VALUES ($1, $2::jsonb, 'running')
     RETURNING *`,
    [regionName, JSON.stringify(bbox)]
  );
  return result.rows[0];
}

async function finishJob(jobId, status, counts, error = null) {
  await db.query(
    `UPDATE import_jobs
     SET status = $2,
         finished_at = NOW(),
         total_imported = $3,
         total_updated = $4,
         error = $5
     WHERE id = $1`,
    [jobId, status, counts.imported, counts.updated, error]
  );
}

async function importBoundingBox(minLat, minLon, maxLat, maxLon, options = {}) {
  await ensureMarinePOITables();
  const bbox = { minLat, minLon, maxLat, maxLon };
  const job = await createJob(options.regionName || 'custom_bbox', bbox);
  const counts = { imported: 0, updated: 0, skipped: 0 };

  try {
    const json = await fetchOverpass(bbox);
    const elements = Array.isArray(json.elements) ? json.elements : [];

    for (const element of elements) {
      let poi = normalizeOSMElement(element);
      if (!poi || poi.type === 'unknown_marine') {
        counts.skipped += 1;
        continue;
      }

      poi = enrichMarinePOI(poi);
      if (!poi.ai_summary && isGeminiConfigured()) {
        try {
          poi.ai_summary = await generateSummary(poi);
        } catch (err) {
          console.warn(`Gemini POI enrichment skipped for ${poi.source_id}: ${err.message}`);
        }
      }

      const status = await upsertPOI(poi);
      if (status === 'inserted') counts.imported += 1;
      else counts.updated += 1;
    }

    await finishJob(job.id, 'completed', counts);
    return { jobId: job.id, ...counts };
  } catch (err) {
    await finishJob(job.id, 'failed', counts, err.message);
    throw err;
  }
}

async function importRegion(regionName, options = {}) {
  const bbox = REGIONS[regionName];
  if (!bbox) throw new Error(`Unknown marine import region: ${regionName}`);

  const tiles = tileRegion(bbox, options.stepDegrees || 2);
  const totals = { imported: 0, updated: 0, skipped: 0, failedTiles: 0 };

  for (const tile of tiles) {
    try {
      const result = await importBoundingBox(tile.minLat, tile.minLon, tile.maxLat, tile.maxLon, {
        regionName,
      });
      totals.imported += result.imported;
      totals.updated += result.updated;
      totals.skipped += result.skipped;
    } catch (err) {
      totals.failedTiles += 1;
      console.warn(`Marine POI tile failed for ${regionName} ${bboxString(tile)}: ${err.message}`);
    }
    await sleep(options.delayMs ?? 1200);
  }

  return totals;
}

async function importWorldwideInTiles(options = {}) {
  const world = { minLat: -60, minLon: -180, maxLat: 75, maxLon: 180 };
  const tiles = tileRegion(world, options.stepDegrees || 10);
  const totals = { imported: 0, updated: 0, skipped: 0, failedTiles: 0 };

  for (const tile of tiles) {
    try {
      const result = await importBoundingBox(tile.minLat, tile.minLon, tile.maxLat, tile.maxLon, {
        regionName: 'world',
      });
      totals.imported += result.imported;
      totals.updated += result.updated;
      totals.skipped += result.skipped;
    } catch (err) {
      totals.failedTiles += 1;
      console.warn(`Marine POI world tile failed ${bboxString(tile)}: ${err.message}`);
    }
    await sleep(options.delayMs ?? 1500);
  }

  return totals;
}

module.exports = {
  REGIONS,
  buildOverpassQuery,
  importBoundingBox,
  importRegion,
  importWorldwideInTiles,
};
