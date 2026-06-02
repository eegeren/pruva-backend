const db = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const { lat, lon, radius = 50 } = req.query;
    let query = 'SELECT * FROM anchorages ORDER BY name';
    let params = [];

    // Nearby anchorages with Haversine distance in kilometers
    if (lat && lon) {
      const parsedLat = Number(lat);
      const parsedLon = Number(lon);
      const parsedRadius = Number(radius);

      if ([parsedLat, parsedLon, parsedRadius].some((value) => Number.isNaN(value))) {
        return res.status(400).json({ error: 'lat, lon and radius must be numeric values' });
      }

      query = `
        SELECT * FROM (
          SELECT
            a.*,
            (
              6371 * acos(
                cos(radians($1)) * cos(radians(a.latitude)) *
                cos(radians(a.longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(a.latitude))
              )
            ) AS distance
          FROM anchorages a
        ) nearby
        WHERE distance <= $3
        ORDER BY distance
      `;
      params = [parsedLat, parsedLon, parsedRadius];
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM anchorages WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Anchorage not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getByBounds = async (req, res, next) => {
  try {
    const { minLat, maxLat, minLon, maxLon } = req.query;
    if (!minLat || !maxLat || !minLon || !maxLon) {
      return res.status(400).json({ error: 'minLat, maxLat, minLon and maxLon are required' });
    }
    const result = await db.query(
      `SELECT
         a.*,
         COUNT(c.id) FILTER (WHERE c.is_current = true) AS current_visitors
       FROM anchorages a
       LEFT JOIN checkins c ON c.anchorage_id = a.id
       WHERE a.latitude BETWEEN $1 AND $2
       AND a.longitude BETWEEN $3 AND $4
       GROUP BY a.id
       LIMIT 200`,
      [minLat, maxLat, minLon, maxLon]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const result = await db.query(
      'SELECT * FROM anchorages WHERE name ILIKE $1 LIMIT 20',
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
