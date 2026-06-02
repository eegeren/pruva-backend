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
       ORDER BY COALESCE(started_at, departed_at, created_at) DESC`,
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

    const from_name = req.body.departure_name ?? req.body.departureName ?? req.body.from_name ?? req.body.fromName;
    const to_name = req.body.arrival_name ?? req.body.arrivalName ?? req.body.to_name ?? req.body.toName;
    const from_latitude = req.body.departure_lat ?? req.body.departureLat ?? req.body.from_latitude ?? req.body.fromLatitude;
    const from_longitude = req.body.departure_lon ?? req.body.departureLon ?? req.body.from_longitude ?? req.body.fromLongitude;
    const to_latitude = req.body.arrival_lat ?? req.body.arrivalLat ?? req.body.to_latitude ?? req.body.toLatitude;
    const to_longitude = req.body.arrival_lon ?? req.body.arrivalLon ?? req.body.to_longitude ?? req.body.toLongitude;
    const departed_at = req.body.started_at ?? req.body.startedAt ?? req.body.departed_at ?? req.body.departedAt;
    const arrived_at = req.body.ended_at ?? req.body.endedAt ?? req.body.arrived_at ?? req.body.arrivedAt;
    const distance_nm = req.body.distance_nm ?? req.body.distanceNm;
    const duration_minutes = req.body.duration_minutes ?? req.body.durationMinutes;
    const duration_hours = req.body.duration_hours ?? req.body.durationHours ?? (duration_minutes != null ? Number(duration_minutes) / 60 : null);
    const avg_speed_kn = req.body.average_speed_knots ?? req.body.averageSpeedKnots ?? req.body.avg_speed_kn ?? req.body.avgSpeedKn;
    const fuel_used_l = req.body.fuel_used_l ?? req.body.fuelUsedL;
    const weather_summary = req.body.weather_summary ?? req.body.weatherSummary;
    const notes = req.body.notes;

    if (!from_name && !to_name) {
      return res.status(400).json({ error: 'Departure or arrival is required' });
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
        (boat_id, from_name, to_name, departure_name, arrival_name, from_lat, from_lon, to_lat, to_lon, departure_lat, departure_lon, arrival_lat, arrival_lon, departed_at, arrived_at, started_at, ended_at, duration_hours, duration_minutes, distance_nm, avg_speed_kn, average_speed_knots, fuel_used_l, weather_summary, notes)
       VALUES
        ($1, $2, $3, $2, $3, $4, $5, $6, $7, $4, $5, $6, $7, $8, $9, $8, $9, $10, $11, $12, $13, $13, $14, $15, $16)
       RETURNING *`,
      [
        boatId,
        from_name ?? null,
        to_name ?? null,
        Number.isFinite(fromLat) ? fromLat : null,
        Number.isFinite(fromLon) ? fromLon : null,
        Number.isFinite(toLat) ? toLat : null,
        Number.isFinite(toLon) ? toLon : null,
        departed_at ?? null,
        arrived_at ?? null,
        computedDuration,
        computedDuration != null ? Math.round(computedDuration * 60) : null,
        computedDistance,
        computedAvgSpeed,
        fuel_used_l ?? null,
        weather_summary ?? null,
        notes ?? null,
      ]
    );
    await db.query(
      `INSERT INTO boat_events (boat_id, type, title, description, metadata)
       VALUES ($1, 'voyage_completed', 'Voyage logged', $2, $3)`,
      [boatId, `${from_name || 'Departure'} to ${to_name || 'Arrival'}`, { voyage_id: result.rows[0].id }]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { boatId, voyageId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      `UPDATE voyage_logs
       SET departure_name = COALESCE($1, departure_name),
           arrival_name = COALESCE($2, arrival_name),
           distance_nm = COALESCE($3, distance_nm),
           duration_minutes = COALESCE($4, duration_minutes),
           average_speed_knots = COALESCE($5, average_speed_knots),
           fuel_used_l = COALESCE($6, fuel_used_l),
           weather_summary = COALESCE($7, weather_summary),
           notes = COALESCE($8, notes)
       WHERE id = $9 AND boat_id = $10
       RETURNING *`,
      [
        req.body.departure_name ?? req.body.departureName ?? null,
        req.body.arrival_name ?? req.body.arrivalName ?? null,
        req.body.distance_nm ?? req.body.distanceNm ?? null,
        req.body.duration_minutes ?? req.body.durationMinutes ?? null,
        req.body.average_speed_knots ?? req.body.averageSpeedKnots ?? null,
        req.body.fuel_used_l ?? req.body.fuelUsedL ?? null,
        req.body.weather_summary ?? req.body.weatherSummary ?? null,
        req.body.notes ?? null,
        voyageId,
        boatId,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Voyage log not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { boatId, voyageId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      'DELETE FROM voyage_logs WHERE id = $1 AND boat_id = $2 RETURNING id',
      [voyageId, boatId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Voyage log not found' });
    res.json({ message: 'Voyage log deleted' });
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
