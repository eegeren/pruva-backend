const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      'SELECT * FROM fuel_logs WHERE boat_id = $1 ORDER BY logged_at DESC',
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

    const liters = req.body.liters;
    const price_per_liter = req.body.price_per_liter ?? req.body.pricePerLiter;
    const total_cost = req.body.total_cost ?? req.body.totalCost;
    const location_name = req.body.location_name ?? req.body.locationName;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const engine_hours = req.body.engine_hours ?? req.body.engineHours;
    const notes = req.body.notes;
    const logged_at = req.body.logged_at ?? req.body.loggedAt;

    if (liters == null || price_per_liter == null) {
      return res.status(400).json({ error: 'liters and price_per_liter are required' });
    }

    const computedTotalCost =
      total_cost != null ? Number(total_cost) : Number(liters) * Number(price_per_liter);

    const result = await db.query(
      `INSERT INTO fuel_logs
        (boat_id, liters, price_per_liter, total_cost, location_name, latitude, longitude, engine_hours, notes, logged_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()))
       RETURNING *`,
      [
        boatId,
        liters,
        price_per_liter,
        computedTotalCost,
        location_name ?? null,
        latitude ?? null,
        longitude ?? null,
        engine_hours ?? null,
        notes ?? null,
        logged_at ?? null,
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

    const aggregate = await db.query(
      `SELECT
         COALESCE(SUM(total_cost), 0) AS total_cost,
         COALESCE(SUM(liters), 0) AS total_liters,
         COALESCE(AVG(price_per_liter), 0) AS avg_price,
         COUNT(*) AS total_refuels
       FROM fuel_logs
       WHERE boat_id = $1`,
      [boatId]
    );

    const lastTen = await db.query(
      `SELECT * FROM fuel_logs
       WHERE boat_id = $1
       ORDER BY logged_at DESC
       LIMIT 10`,
      [boatId]
    );

    res.json({
      ...aggregate.rows[0],
      last_10: lastTen.rows,
    });
  } catch (err) {
    next(err);
  }
};
