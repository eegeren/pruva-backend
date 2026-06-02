const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      `SELECT *,
              COALESCE(location, location_name) AS location,
              COALESCE(refuel_date, logged_at) AS refuel_date,
              COALESCE(location_name, location) AS location_name,
              COALESCE(logged_at, refuel_date) AS logged_at
       FROM fuel_logs WHERE boat_id = $1 ORDER BY COALESCE(refuel_date, logged_at, created_at) DESC`,
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
    const location_name = req.body.location ?? req.body.location_name ?? req.body.locationName;
    const currency = req.body.currency ?? 'EUR';
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const engine_hours = req.body.engine_hours ?? req.body.engineHours;
    const notes = req.body.notes;
    const logged_at = req.body.refuel_date ?? req.body.refuelDate ?? req.body.logged_at ?? req.body.loggedAt;

    if (liters == null || Number(liters) <= 0) {
      return res.status(400).json({ error: 'Fuel liters must be greater than 0' });
    }

    const computedTotalCost =
      total_cost != null ? Number(total_cost) : price_per_liter != null ? Number(liters) * Number(price_per_liter) : null;

    const result = await db.query(
      `INSERT INTO fuel_logs
        (boat_id, liters, price_per_liter, total_cost, currency, location_name, location, latitude, longitude, engine_hours, notes, logged_at, refuel_date)
       VALUES
        ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, COALESCE($11, NOW()), COALESCE($11, NOW()))
       RETURNING *`,
      [
        boatId,
        liters,
        price_per_liter ?? null,
        computedTotalCost,
        currency,
        location_name ?? null,
        latitude ?? null,
        longitude ?? null,
        engine_hours ?? null,
        notes ?? null,
        logged_at ?? null,
      ]
    );
    await db.query(
      `INSERT INTO boat_events (boat_id, type, title, description, metadata)
       VALUES ($1, 'fuel_added', 'Fuel added', $2, $3)`,
      [boatId, `${liters} L`, { fuel_log_id: result.rows[0].id, liters }]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { boatId, fuelLogId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      'DELETE FROM fuel_logs WHERE id = $1 AND boat_id = $2 RETURNING id',
      [fuelLogId, boatId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Fuel log not found' });
    res.json({ message: 'Fuel log deleted' });
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
