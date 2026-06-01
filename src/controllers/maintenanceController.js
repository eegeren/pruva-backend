const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      `SELECT * FROM maintenance_logs
       WHERE boat_id = $1
       ORDER BY done_at DESC`,
      [boatId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getUpcoming = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      `SELECT * FROM maintenance_logs
       WHERE boat_id = $1
         AND next_due_at IS NOT NULL
         AND next_due_at <= NOW() + INTERVAL '30 days'
       ORDER BY next_due_at ASC`,
      [boatId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const title = req.body.title;
    const category = req.body.category;
    const description = req.body.description;
    const cost = req.body.cost;
    const engine_hours = req.body.engine_hours ?? req.body.engineHours;
    const done_at = req.body.done_at ?? req.body.doneAt;
    const next_due_at = req.body.next_due_at ?? req.body.nextDueAt;
    const reminder_days = req.body.reminder_days ?? req.body.reminderDays;

    if (!title || !category) {
      return res.status(400).json({ error: 'title and category are required' });
    }

    const result = await db.query(
      `INSERT INTO maintenance_logs
        (boat_id, title, category, description, cost, engine_hours, done_at, next_due_at, reminder_days)
       VALUES
        ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), $8, $9)
       RETURNING *`,
      [
        boatId,
        title,
        category,
        description ?? null,
        cost ?? null,
        engine_hours ?? null,
        done_at ?? null,
        next_due_at ?? null,
        reminder_days ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      `SELECT
         COALESCE(SUM(cost), 0) AS total_cost_this_year,
         COUNT(*) AS total_records
       FROM maintenance_logs
       WHERE boat_id = $1
         AND EXTRACT(YEAR FROM done_at) = EXTRACT(YEAR FROM NOW())`,
      [boatId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
