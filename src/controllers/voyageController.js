const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');

function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      `SELECT * FROM voyage_logs
       WHERE boat_id = $1
       ORDER BY departed_at DESC`,
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

    const from_name = req.body.from_name ?? req.body.fromName;
    const to_name = req.body.to_name ?? req.body.toName;
    const from_latitude = req.body.from_latitude ?? req.body.fromLatitude;
    const from_longitude = req.body.from_longitude ?? req.body.fromLongitude;
    const to_latitude = req.body.to_latitude ?? req.body.toLatitude;
    const to_longitude = req.body.to_longitude ?? req.body.toLongitude;
    const departed_at = req.body.departed_at ?? req.body.departedAt;
    const arrived_at = req.body.arrived_at ?? req.body.arrivedAt;
    const distance_nm = req.body.distance_nm ?? req.body.distanceNm;
    const duration_hours = req.body.duration_hours ?? req.body.durationHours;
    const avg_speed_kn = req.body.avg_speed_kn ?? req.body.avgSpeedKn;
    const fuel_used_l = req.body.fuel_used_l ?? req.body.fuelUsedL;
    const notes = req.body.notes;

    if (!departed_at) {
      return res.status(400).json({ error: 'departed_at is required' });
    }

    const fromLat = Number(from_latitude);
    const fromLon = Number(from_longitude);
    const toLat = Number(to_latitude);
    const toLon = Number(to_longitude);

    let computedDistance = distance_nm ?? null;
    if (
      Number.isFinite(fromLat) &&
      Number.isFinite(fromLon) &&
      Number.isFinite(toLat) &&
      Number.isFinite(toLon)
    ) {
      computedDistance = haversineNm(fromLat, fromLon, toLat, toLon);
    }

    let computedDuration = duration_hours ?? null;
    if (departed_at && arrived_at) {
      const departDate = new Date(departed_at);
      const arriveDate = new Date(arrived_at);
      if (!Number.isNaN(departDate.getTime()) && !Number.isNaN(arriveDate.getTime())) {
        const hours = (arriveDate.getTime() - departDate.getTime()) / (1000 * 60 * 60);
        computedDuration = hours > 0 ? hours : null;
      }
    }

    let computedAvgSpeed = avg_speed_kn ?? null;
    if (
      computedAvgSpeed == null &&
      computedDistance != null &&
      computedDuration != null &&
      computedDuration > 0
    ) {
      computedAvgSpeed = computedDistance / computedDuration;
    }

    const result = await db.query(
      `INSERT INTO voyage_logs
        (boat_id, from_name, to_name, from_latitude, from_longitude, to_latitude, to_longitude, departed_at, arrived_at, duration_hours, distance_nm, avg_speed_kn, fuel_used_l, notes)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        boatId,
        from_name ?? null,
        to_name ?? null,
        Number.isFinite(fromLat) ? fromLat : null,
        Number.isFinite(fromLon) ? fromLon : null,
        Number.isFinite(toLat) ? toLat : null,
        Number.isFinite(toLon) ? toLon : null,
        departed_at,
        arrived_at ?? null,
        computedDuration,
        computedDistance,
        computedAvgSpeed,
        fuel_used_l ?? null,
        notes ?? null,
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
         COALESCE(SUM(distance_nm), 0) AS total_distance_nm,
         COUNT(*) AS total_voyages,
         COALESCE(SUM(duration_hours), 0) AS total_hours,
         COALESCE(MAX(distance_nm), 0) AS longest_voyage_nm,
         COALESCE(AVG(avg_speed_kn), 0) AS avg_speed,
         COALESCE(SUM(fuel_used_l), 0) AS total_fuel_used
       FROM voyage_logs
       WHERE boat_id = $1`,
      [boatId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
