const db = require('../config/db');
const { importBoundingBox, importRegion } = require('../services/overpassMarineImporter');
const { ensureMarinePOITables } = require('../services/marinePOISchema');

const ALLOWED_TYPES = new Set([
  'marina',
  'anchorage',
  'bay',
  'fuel_station',
  'service_point',
  'harbor',
  'dive_site',
  'unknown_marine',
]);

function parseTypes(value) {
  if (!value) return null;
  const types = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return types.filter((type) => ALLOWED_TYPES.has(type));
}

function parseLimit(value, fallback = 250) {
  const limit = Number(value);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(Math.round(limit), 1000));
}

function mapTypeToApp(type) {
  switch (type) {
    case 'fuel_station':
      return 'fuel';
    case 'service_point':
      return 'service';
    case 'dive_site':
      return 'diving';
    case 'anchorage':
      return 'anchorage';
    case 'bay':
      return 'beach';
    case 'harbor':
      return 'marina';
    default:
      return type;
  }
}

function displayArray(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMarinePOIRow(row) {
  if (!row) return null;
  const facilities = displayArray(row.facilities);
  const fuelTypes = displayArray(row.fuel_types);

  return {
    id: row.id,
    source: row.source,
    source_id: row.source_id,
    osm_type: row.osm_type,
    osm_id: row.osm_id == null ? null : Number(row.osm_id),
    type: row.type,
    app_type: mapTypeToApp(row.type),
    name: row.name || 'Marine Point',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    country: row.country,
    region: row.region,
    city: row.city,
    address: row.address,
    tags: row.tags || {},
    description: row.description,
    ai_summary: row.ai_summary,
    rating: row.rating == null ? null : Number(row.rating),
    review_count: row.review_count,
    phone: row.phone,
    website: row.website,
    vhf_channel: row.vhf_channel,
    opening_hours: row.opening_hours,
    entrance_depth_m: row.entrance_depth_m == null ? null : Number(row.entrance_depth_m),
    berth_capacity: row.berth_capacity,
    fuel_types: fuelTypes,
    facilities,
    price_range: row.price_range,
    holding_type: row.holding_type,
    seabed_type: row.seabed_type,
    shelter_quality: row.shelter_quality,
    depth_min_m: row.depth_min_m == null ? null : Number(row.depth_min_m),
    depth_max_m: row.depth_max_m == null ? null : Number(row.depth_max_m),
    imported_at: row.imported_at,
    updated_at: row.updated_at,
  };
}

function mapMarinePOIToMapPoint(row) {
  const poi = formatMarinePOIRow(row);
  if (!poi) return null;
  return {
    id: `marine-${poi.id}`,
    name: poi.name,
    type: poi.app_type,
    anchorage_id: null,
    latitude: poi.latitude,
    longitude: poi.longitude,
    description: poi.ai_summary || poi.description,
    phone: poi.phone,
    website: poi.website,
    vhf_channel: poi.vhf_channel,
    depth_m: poi.entrance_depth_m || poi.depth_max_m || poi.depth_min_m,
    berth_count: poi.berth_capacity,
    opening_hours: poi.opening_hours,
    fuel_types: poi.fuel_types,
    amenities: poi.facilities?.join(', ') || null,
    ai_summary: poi.ai_summary,
    ai_reviews: [],
    rating: poi.rating || 0,
    marine_poi: poi,
  };
}

exports.getByBounds = async (req, res, next) => {
  try {
    await ensureMarinePOITables();
    const bbox = req.query.bbox ? String(req.query.bbox).split(',').map(Number) : null;
    const minLat = bbox ? bbox[0] : Number(req.query.minLat);
    const minLon = bbox ? bbox[1] : Number(req.query.minLon);
    const maxLat = bbox ? bbox[2] : Number(req.query.maxLat);
    const maxLon = bbox ? bbox[3] : Number(req.query.maxLon);

    if ([minLat, minLon, maxLat, maxLon].some((value) => !Number.isFinite(value))) {
      return res.status(400).json({ error: 'bbox or minLat, minLon, maxLat, maxLon are required' });
    }

    const types = parseTypes(req.query.types);
    const limit = parseLimit(req.query.limit);
    const asMapPoints = req.query.format === 'map_points';

    const params = [minLat, maxLat, minLon, maxLon];
    let where = 'latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4';
    if (types?.length) {
      params.push(types);
      where += ` AND type = ANY($${params.length})`;
    }
    params.push(limit);

    const result = await db.query(
      `SELECT *
       FROM marine_pois
       WHERE ${where}
       ORDER BY
         CASE WHEN name IS NULL THEN 1 ELSE 0 END,
         updated_at DESC
       LIMIT $${params.length}`,
      params
    );

    const rows = asMapPoints ? result.rows.map(mapMarinePOIToMapPoint) : result.rows.map(formatMarinePOIRow);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    await ensureMarinePOITables();
    const rawId = String(req.params.id).replace(/^marine-/, '');
    const result = await db.query('SELECT * FROM marine_pois WHERE id = $1', [rawId]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Marine POI not found' });
    res.json(formatMarinePOIRow(row));
  } catch (err) {
    next(err);
  }
};

exports.nearby = async (req, res, next) => {
  try {
    await ensureMarinePOITables();
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radiusKm = Number(req.query.radiusKm || 25);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const types = parseTypes(req.query.types);
    const limit = parseLimit(req.query.limit, 100);
    const delta = Math.max(radiusKm / 111, 0.02);
    const params = [lat, lon, lat - delta, lat + delta, lon - delta, lon + delta];
    let where = 'latitude BETWEEN $3 AND $4 AND longitude BETWEEN $5 AND $6';
    if (types?.length) {
      params.push(types);
      where += ` AND type = ANY($${params.length})`;
    }
    params.push(limit);

    const result = await db.query(
      `SELECT *,
        (6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians($1)) * cos(radians(latitude::float8)) *
            cos(radians(longitude::float8) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude::float8))
          ))
        )) AS distance_km
       FROM marine_pois
       WHERE ${where}
       ORDER BY distance_km ASC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows.map(formatMarinePOIRow));
  } catch (err) {
    next(err);
  }
};

exports.search = async (req, res, next) => {
  try {
    await ensureMarinePOITables();
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const types = parseTypes(req.query.types);
    const limit = parseLimit(req.query.limit, 50);
    const params = [`%${q.toLowerCase()}%`];
    let where = '(LOWER(name) LIKE $1 OR normalized_name LIKE $1 OR LOWER(city) LIKE $1 OR LOWER(region) LIKE $1)';
    if (types?.length) {
      params.push(types);
      where += ` AND type = ANY($${params.length})`;
    }
    params.push(limit);

    const result = await db.query(
      `SELECT *
       FROM marine_pois
       WHERE ${where}
       ORDER BY
         CASE WHEN LOWER(name) LIKE $1 THEN 0 ELSE 1 END,
         name ASC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows.map(formatMarinePOIRow));
  } catch (err) {
    next(err);
  }
};

exports.importRegion = async (req, res, next) => {
  try {
    await ensureMarinePOITables();
    const region = req.body?.region || req.params.region;
    if (!region) return res.status(400).json({ error: 'region is required' });
    const result = await importRegion(region);
    res.json({ region, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Marine POI import failed' });
  }
};

exports.importBoundingBox = async (req, res, next) => {
  try {
    await ensureMarinePOITables();
    const { minLat, minLon, maxLat, maxLon } = req.body || {};
    const values = [minLat, minLon, maxLat, maxLon].map(Number);
    if (values.some((value) => !Number.isFinite(value))) {
      return res.status(400).json({ error: 'minLat, minLon, maxLat and maxLon are required' });
    }

    const result = await importBoundingBox(values[0], values[1], values[2], values[3], {
      regionName: req.body.region || 'admin_bbox',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Marine POI import failed' });
  }
};
