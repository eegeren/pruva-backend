const db = require('../config/db');

exports.getByAnchorage = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.username FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.anchorage_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { text, depth_observed } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const anchorageExists = await db.query('SELECT id FROM anchorages WHERE id = $1', [req.params.id]);
    if (!anchorageExists.rows[0]) {
      return res.status(404).json({ error: 'Anchorage not found' });
    }

    const result = await db.query(
      `INSERT INTO comments (anchorage_id, user_id, text, depth_observed)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.user.id, text, depth_observed]
    );

    // Keep count in sync with incoming user reports
    await db.query(
      `UPDATE anchorages
       SET rating_count = rating_count + 1
       WHERE id = $1`,
      [req.params.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
