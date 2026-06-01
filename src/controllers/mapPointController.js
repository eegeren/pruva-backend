const db = require('../config/db');
const { enrichMapPoint, getQuotaStatus } = require('../services/geminiMapPointEnrichment');
const { formatMapPointRow, formatMapPointRows } = require('../utils/mapPointRow');

async function ensureAiColumns() {
  await db.query(`
    ALTER TABLE map_points ADD COLUMN IF NOT EXISTS amenities TEXT;
    ALTER TABLE map_points ADD COLUMN IF NOT EXISTS ai_summary TEXT;
    ALTER TABLE map_points ADD COLUMN IF NOT EXISTS ai_reviews JSONB;
    ALTER TABLE map_points ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP;
  `);
}

exports.getByBounds = async (req, res, next) => {
  try {
    const { minLat, maxLat, minLon, maxLon, type } = req.query;

    if ([minLat, maxLat, minLon, maxLon].some((value) => value == null)) {
      return res.status(400).json({ error: 'minLat, maxLat, minLon and maxLon are required' });
    }

    const bounds = [Number(minLat), Number(maxLat), Number(minLon), Number(maxLon)];
    if (bounds.some((value) => Number.isNaN(value))) {
      return res.status(400).json({ error: 'Bounds must be valid numbers' });
    }

    let query = `SELECT * FROM map_points
      WHERE latitude BETWEEN $1 AND $2
      AND longitude BETWEEN $3 AND $4`;
    const params = bounds;

    if (type) {
      query += ' AND type = $5';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await db.query(query, params);
    res.json(formatMapPointRows(result.rows));
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    await ensureAiColumns();

    const result = await db.query('SELECT * FROM map_points WHERE id = $1', [req.params.id]);
    let point = result.rows[0];

    if (!point) {
      return res.status(404).json({ error: 'Map point not found' });
    }

    const skipEnrich = req.query.enrich === 'false';
    const forceEnrich = req.query.enrich === 'force';
    let enrichmentStatus = skipEnrich ? 'skipped' : 'not_configured';

    if (!skipEnrich) {
      if (!(process.env.GEMINI_API_KEY || '').trim().startsWith('AIza')) {
        console.warn('GEMINI_API_KEY missing on server — map point details will not be AI-filled.');
      } else {
        enrichmentStatus = 'pending';
        try {
          const before = point.enriched_at;
          point = await enrichMapPoint(point, db, { force: forceEnrich });
          enrichmentStatus = point.enriched_at && point.enriched_at !== before ? 'applied' : 'no_new_data';
        } catch (err) {
          enrichmentStatus = 'error';
          console.warn(`Gemini enrichment failed for ${point.id}:`, err.message);
        }
      }
    }

    const quota = getQuotaStatus();
    if (quota.blocked) enrichmentStatus = 'quota_exceeded';
    res.setHeader('X-Pruva-Enrichment', enrichmentStatus);
    if (quota.blocked_until) {
      res.setHeader('X-Pruva-Gemini-Quota-Until', quota.blocked_until);
    }
    res.json(formatMapPointRow(point));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      name,
      type,
      latitude,
      longitude,
      description,
      phone,
      website,
      vhf_channel,
      fuel_types,
      depth_m,
      berth_count,
      opening_hours,
    } = req.body;

    if (!name || !type || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'name, type, latitude and longitude are required' });
    }

    const latNum = Number(latitude);
    const lonNum = Number(longitude);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      return res.status(400).json({ error: 'latitude and longitude must be valid numbers' });
    }

    const allowedTypes = ['marina', 'fuel', 'service'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'type must be one of marina, fuel, service' });
    }

    const depthNum = depth_m == null ? null : Number(depth_m);
    const berthNum = berth_count == null ? null : Number(berth_count);
    if (depthNum != null && Number.isNaN(depthNum)) {
      return res.status(400).json({ error: 'depth_m must be a valid number' });
    }
    if (berthNum != null || berth_count === 0) {
      if (!Number.isInteger(berthNum)) {
        return res.status(400).json({ error: 'berth_count must be an integer' });
      }
    }

    let fuelTypes = null;
    if (fuel_types != null) {
      if (Array.isArray(fuel_types)) {
        fuelTypes = fuel_types;
      } else if (typeof fuel_types === 'string') {
        fuelTypes = fuel_types
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        return res.status(400).json({ error: 'fuel_types must be an array or comma-separated string' });
      }
    }

    const result = await db.query(
      `INSERT INTO map_points
        (name, type, latitude, longitude, description, phone, website, vhf_channel, fuel_types, depth_m, berth_count, opening_hours)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        name,
        type,
        latNum,
        lonNum,
        description ?? null,
        phone ?? null,
        website ?? null,
        vhf_channel ?? null,
        fuelTypes,
        depthNum,
        berthNum,
        opening_hours ?? null,
      ]
    );

    res.status(201).json(formatMapPointRow(result.rows[0]));
  } catch (err) {
    next(err);
  }
};

exports.rate = async (req, res, next) => {
  try {
    const ratingNum = Number(req.body.rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
    }

    const pointQuery = await db.query('SELECT id, rating FROM map_points WHERE id = $1', [req.params.id]);
    const point = pointQuery.rows[0];

    if (!point) {
      return res.status(404).json({ error: 'Map point not found' });
    }

    await db.query(
      `INSERT INTO map_point_ratings (map_point_id, user_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (map_point_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()`,
      [req.params.id, req.user.id, ratingNum]
    );

    const ratingSummary = await db.query(
      `SELECT COALESCE(AVG(rating), 0)::float8 AS avg_rating, COUNT(*)::int AS rating_count
       FROM map_point_ratings
       WHERE map_point_id = $1`,
      [req.params.id]
    );

    const avgRating = ratingSummary.rows[0].avg_rating;
    const ratingCount = ratingSummary.rows[0].rating_count;

    const result = await db.query(
      `UPDATE map_points
       SET rating = $2
       WHERE id = $1
       RETURNING id, rating`,
      [req.params.id, avgRating]
    );

    res.json({ id: result.rows[0].id, rating: Number(result.rows[0].rating), rating_count: ratingCount });
  } catch (err) {
    next(err);
  }
};
