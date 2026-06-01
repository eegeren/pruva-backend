const db = require('../config/db');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreSegmentRisk(segment) {
  const windKn = Number(segment.wind_kn ?? 0);
  const gustKn = Number(segment.gust_kn ?? 0);
  const waveM = Number(segment.wave_m ?? 0);
  const currentKn = Number(segment.current_kn ?? 0);
  const visibilityNm = Number(segment.visibility_nm ?? 10);
  const rainMm = Number(segment.rain_mm ?? 0);
  const night = Boolean(segment.is_night);

  const windRisk = clamp((windKn / 40) * 100, 0, 100);
  const gustRisk = clamp((gustKn / 50) * 100, 0, 100);
  const waveRisk = clamp((waveM / 4) * 100, 0, 100);
  const currentRisk = clamp((currentKn / 5) * 100, 0, 100);
  const visibilityRisk = clamp(((10 - visibilityNm) / 10) * 100, 0, 100);
  const rainRisk = clamp((rainMm / 20) * 100, 0, 100);
  const nightRisk = night ? 20 : 0;

  const weightedScore =
    windRisk * 0.23 +
    gustRisk * 0.17 +
    waveRisk * 0.25 +
    currentRisk * 0.12 +
    visibilityRisk * 0.15 +
    rainRisk * 0.08 +
    nightRisk;

  const score = clamp(Math.round(weightedScore), 0, 100);

  let level = 'low';
  if (score >= 70) level = 'high';
  else if (score >= 45) level = 'medium';

  return {
    score,
    level,
    breakdown: {
      wind: Math.round(windRisk),
      gust: Math.round(gustRisk),
      wave: Math.round(waveRisk),
      current: Math.round(currentRisk),
      visibility: Math.round(visibilityRisk),
      rain: Math.round(rainRisk),
      night: nightRisk,
    },
  };
}

exports.analyzeRouteRisk = async (req, res, next) => {
  try {
    const { routeName, segments = [] } = req.body;
    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'segments array is required' });
    }

    const analyzedSegments = segments.map((segment, index) => {
      const risk = scoreSegmentRisk(segment);
      return {
        idx: index,
        from_lat: segment.from_lat,
        from_lon: segment.from_lon,
        to_lat: segment.to_lat,
        to_lon: segment.to_lon,
        distance_nm: Number(segment.distance_nm ?? 0),
        ...risk,
      };
    });

    const avg = analyzedSegments.reduce((acc, cur) => acc + cur.score, 0) / analyzedSegments.length;
    const routeScore = Math.round(avg);

    const routeInsert = await db.query(
      `INSERT INTO pro_routes (user_id, name, start_lat, start_lon, end_lat, end_lon, risk_score, distance_nm, duration_hours, preference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        req.user.id,
        routeName ?? 'Untitled route',
        segments[0].from_lat ?? null,
        segments[0].from_lon ?? null,
        segments[segments.length - 1].to_lat ?? null,
        segments[segments.length - 1].to_lon ?? null,
        routeScore,
        segments.reduce((acc, cur) => acc + Number(cur.distance_nm ?? 0), 0),
        Number(req.body.duration_hours ?? null),
        req.body.preference ?? 'safest',
      ]
    );

    await Promise.all(
      analyzedSegments.map((segment) =>
        db.query(
          `INSERT INTO route_segment_risks
           (route_id, segment_index, from_lat, from_lon, to_lat, to_lon, distance_nm, risk_score, risk_level, breakdown)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
          [
            routeInsert.rows[0].id,
            segment.idx,
            segment.from_lat ?? null,
            segment.from_lon ?? null,
            segment.to_lat ?? null,
            segment.to_lon ?? null,
            segment.distance_nm ?? 0,
            segment.score,
            segment.level,
            JSON.stringify(segment.breakdown),
          ]
        )
      )
    );

    res.status(201).json({
      route_id: routeInsert.rows[0].id,
      route_score: routeScore,
      threshold: { low: 0, medium: 45, high: 70 },
      segments: analyzedSegments,
    });
  } catch (err) {
    next(err);
  }
};

exports.recommendRoutes = async (req, res, next) => {
  try {
    const { start, end, waypoints = [], weatherWindowHours = 24 } = req.body;
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end are required' });
    }

    const directDistance = Number(req.body.distance_nm ?? 20);
    const alternatives = [
      {
        id: 'safest',
        strategy: 'safest',
        distance_nm: Number((directDistance * 1.18).toFixed(1)),
        eta_hours: Number((weatherWindowHours * 0.35).toFixed(1)),
        risk_score: 34,
        fuel_l: Number((directDistance * 1.18 * 3.3).toFixed(1)),
      },
      {
        id: 'shortest',
        strategy: 'shortest',
        distance_nm: Number(directDistance.toFixed(1)),
        eta_hours: Number((weatherWindowHours * 0.31).toFixed(1)),
        risk_score: 58,
        fuel_l: Number((directDistance * 3.8).toFixed(1)),
      },
      {
        id: 'fuel_efficient',
        strategy: 'fuel_efficient',
        distance_nm: Number((directDistance * 1.08).toFixed(1)),
        eta_hours: Number((weatherWindowHours * 0.37).toFixed(1)),
        risk_score: 41,
        fuel_l: Number((directDistance * 1.08 * 2.9).toFixed(1)),
      },
    ];

    res.json({ start, end, waypoints, alternatives });
  } catch (err) {
    next(err);
  }
};

exports.getAnchorageIntelligence = async (req, res, next) => {
  try {
    const intelligence = await db.query(
      `SELECT *
       FROM anchorage_intelligence
       WHERE anchorage_id = $1
       ORDER BY computed_at DESC
       LIMIT 1`,
      [req.params.anchorageId]
    );

    const crowd = await db.query(
      `SELECT day_of_week, hour_of_day, expected_boats, confidence
       FROM crowd_forecasts
       WHERE anchorage_id = $1
       ORDER BY day_of_week, hour_of_day`,
      [req.params.anchorageId]
    );

    res.json({
      intelligence: intelligence.rows[0] ?? null,
      crowd_forecast: crowd.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.getFuelProfile = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM fuel_profiles WHERE user_id = $1 LIMIT 1', [req.user.id]);
    res.json(result.rows[0] ?? null);
  } catch (err) {
    next(err);
  }
};

exports.upsertFuelProfile = async (req, res, next) => {
  try {
    const { boat_type, cruise_speed_kn, burn_rate_lph, fuel_price_per_l, reserve_pct = 20 } = req.body;
    const result = await db.query(
      `INSERT INTO fuel_profiles (user_id, boat_type, cruise_speed_kn, burn_rate_lph, fuel_price_per_l, reserve_pct)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET
         boat_type = EXCLUDED.boat_type,
         cruise_speed_kn = EXCLUDED.cruise_speed_kn,
         burn_rate_lph = EXCLUDED.burn_rate_lph,
         fuel_price_per_l = EXCLUDED.fuel_price_per_l,
         reserve_pct = EXCLUDED.reserve_pct,
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, boat_type, cruise_speed_kn, burn_rate_lph, fuel_price_per_l, reserve_pct]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.estimateCost = async (req, res, next) => {
  try {
    const { route_id, distance_nm, eta_hours, avg_wind_kn = 0, avg_wave_m = 0 } = req.body;
    const profile = await db.query('SELECT * FROM fuel_profiles WHERE user_id = $1 LIMIT 1', [req.user.id]);
    if (!profile.rows[0]) {
      return res.status(400).json({ error: 'Fuel profile is required' });
    }

    const p = profile.rows[0];
    const weatherPenalty = 1 + Number(avg_wind_kn) * 0.005 + Number(avg_wave_m) * 0.08;
    const fuelUsed = Number(p.burn_rate_lph) * Number(eta_hours) * weatherPenalty;
    const fuelCost = fuelUsed * Number(p.fuel_price_per_l);

    const result = await db.query(
      `INSERT INTO cost_estimates
       (user_id, route_id, distance_nm, eta_hours, avg_wind_kn, avg_wave_m, weather_penalty, estimated_fuel_l, estimated_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.id,
        route_id ?? null,
        distance_nm ?? null,
        eta_hours ?? null,
        avg_wind_kn,
        avg_wave_m,
        weatherPenalty,
        fuelUsed,
        fuelCost,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.listAlertRules = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM alert_rules WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createAlertRule = async (req, res, next) => {
  try {
    const { type, threshold, scope, quiet_hours_start, quiet_hours_end, cooldown_minutes = 60 } = req.body;
    const result = await db.query(
      `INSERT INTO alert_rules
       (user_id, type, threshold, scope, quiet_hours_start, quiet_hours_end, cooldown_minutes)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
       RETURNING *`,
      [req.user.id, type, JSON.stringify(threshold ?? {}), JSON.stringify(scope ?? {}), quiet_hours_start, quiet_hours_end, cooldown_minutes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.listAlertEvents = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT *
       FROM alert_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.listLogbookEntries = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT *
       FROM private_logbook_entries
       WHERE user_id = $1
       ORDER BY logged_at DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createLogbookEntry = async (req, res, next) => {
  try {
    const { title, note, latitude, longitude, weather, tags } = req.body;
    const result = await db.query(
      `INSERT INTO private_logbook_entries (user_id, title, note, latitude, longitude, weather, tags)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::text[])
       RETURNING *`,
      [req.user.id, title, note ?? null, latitude ?? null, longitude ?? null, JSON.stringify(weather ?? {}), tags ?? []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getDeltaSync = async (req, res, next) => {
  try {
    const since = req.query.since_cursor ?? '1970-01-01T00:00:00.000Z';
    const deviceId = req.query.device_id;
    if (!deviceId) return res.status(400).json({ error: 'device_id is required' });

    const changes = await db.query(
      `SELECT stream, entity_id, operation, payload, version, changed_at
       FROM sync_changes
       WHERE user_id = $1 AND changed_at > $2
       ORDER BY changed_at ASC
       LIMIT 1000`,
      [req.user.id, since]
    );

    res.json({
      device_id: deviceId,
      since_cursor: since,
      next_cursor: changes.rows.length ? changes.rows[changes.rows.length - 1].changed_at : since,
      changes: changes.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.ackDeltaSync = async (req, res, next) => {
  try {
    const { device_id, cursor } = req.body;
    if (!device_id || !cursor) {
      return res.status(400).json({ error: 'device_id and cursor are required' });
    }

    const result = await db.query(
      `INSERT INTO device_sync_cursors (user_id, device_id, last_cursor)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET last_cursor = EXCLUDED.last_cursor, updated_at = NOW()
       RETURNING *`,
      [req.user.id, device_id, cursor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
