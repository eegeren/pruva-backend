const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      `SELECT * FROM maintenance_logs
       WHERE boat_id = $1
       ORDER BY COALESCE(due_date, next_due_at, completed_at, done_at, created_at) DESC`,
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
    const currency = req.body.currency ?? 'EUR';
    const engine_hours = req.body.engine_hours ?? req.body.engineHours;
    const done_at = req.body.completed_at ?? req.body.completedAt ?? req.body.done_at ?? req.body.doneAt;
    const next_due_at = req.body.due_date ?? req.body.dueDate ?? req.body.next_due_at ?? req.body.nextDueAt;
    const completed = req.body.completed ?? false;
    const reminder_days = req.body.reminder_days ?? req.body.reminderDays;
    const notes = req.body.notes;

    if (!title) {
      return res.status(400).json({ error: 'Maintenance title is required' });
    }

    const result = await db.query(
      `INSERT INTO maintenance_logs
        (boat_id, title, category, description, cost, currency, engine_hours, done_at, next_due_at, due_date, completed, completed_at, reminder_days, notes)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), $9, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        boatId,
        title,
        category ?? null,
        description ?? null,
        cost ?? null,
        currency,
        engine_hours ?? null,
        done_at ?? null,
        next_due_at ?? null,
        completed,
        completed ? done_at ?? new Date() : null,
        reminder_days ?? null,
        notes ?? null,
      ]
    );
    await db.query(
      `INSERT INTO boat_events (boat_id, type, title, description, metadata)
       VALUES ($1, 'maintenance_created', 'Maintenance created', $2, $3)`,
      [boatId, title, { maintenance_id: result.rows[0].id }]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { boatId, maintenanceId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const due_date = req.body.due_date ?? req.body.dueDate ?? req.body.next_due_at ?? req.body.nextDueAt;
    const completed_at = req.body.completed_at ?? req.body.completedAt ?? null;
    const result = await db.query(
      `UPDATE maintenance_logs
       SET title = COALESCE($1, title),
           category = COALESCE($2, category),
           description = COALESCE($3, description),
           due_date = COALESCE($4, due_date),
           next_due_at = COALESCE($4, next_due_at),
           completed = COALESCE($5, completed),
           completed_at = COALESCE($6, completed_at),
           cost = COALESCE($7, cost),
           currency = COALESCE($8, currency),
           notes = COALESCE($9, notes),
           updated_at = NOW()
       WHERE id = $10 AND boat_id = $11
       RETURNING *`,
      [
        req.body.title ?? null,
        req.body.category ?? null,
        req.body.description ?? null,
        due_date ?? null,
        req.body.completed ?? null,
        completed_at,
        req.body.cost ?? null,
        req.body.currency ?? null,
        req.body.notes ?? null,
        maintenanceId,
        boatId,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Maintenance log not found' });
    if (req.body.completed === true) {
      await db.query(
        `INSERT INTO boat_events (boat_id, type, title, description, metadata)
         VALUES ($1, 'maintenance_completed', 'Maintenance completed', $2, $3)`,
        [boatId, result.rows[0].title, { maintenance_id: maintenanceId }]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { boatId, maintenanceId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      'DELETE FROM maintenance_logs WHERE id = $1 AND boat_id = $2 RETURNING id',
      [maintenanceId, boatId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Maintenance log not found' });
    res.json({ message: 'Maintenance log deleted' });
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
