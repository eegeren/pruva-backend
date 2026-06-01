const db = require('../config/db');

exports.getCurrent = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.username
       FROM checkins c
       JOIN users u ON c.user_id = u.id
       WHERE c.anchorage_id = $1 AND c.is_current = true
       ORDER BY c.arrived_at DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.username
       FROM checkins c
       JOIN users u ON c.user_id = u.id
       WHERE c.anchorage_id = $1
       ORDER BY c.arrived_at DESC
       LIMIT 20`,
      [req.params.id]
    );

    const current = result.rows.filter((row) => row.is_current);
    const recent = result.rows;
    res.json({ current, recent });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  const client = await db.connect();
  try {
    const { boatName, note, depthObserved, waveHeight, windSpeed, bottomQuality } = req.body;

    if (bottomQuality != null) {
      const quality = Number(bottomQuality);
      if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
        return res.status(400).json({ error: 'bottomQuality must be an integer between 1 and 5' });
      }
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE checkins
       SET is_current = false
       WHERE user_id = $1 AND is_current = true`,
      [req.user.id]
    );

    const result = await client.query(
      `INSERT INTO checkins
        (user_id, anchorage_id, boat_name, note, depth_observed, wave_height, wind_speed, bottom_quality)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id,
        req.params.id,
        boatName ?? null,
        note ?? null,
        depthObserved ?? null,
        waveHeight ?? null,
        windSpeed ?? null,
        bottomQuality ?? null,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.checkout = async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE checkins
       SET is_current = false, departed_at = NOW()
       WHERE id = $1 AND anchorage_id = $2 AND user_id = $3
       RETURNING *`,
      [req.params.cid, req.params.id, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Check-in not found or not owned by user' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
