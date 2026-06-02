const db = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM boats WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM boats WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Boat not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const type = req.body.boat_type ?? req.body.boatType ?? req.body.type;
    const { manufacturer, model, country } = req.body;
    const length_m = req.body.length_m ?? req.body.lengthM;
    const beam_m = req.body.beam_m ?? req.body.beamM;
    const draft_m = req.body.draft_m ?? req.body.draftM;
    const fuel_capacity_l = req.body.fuel_capacity_l ?? req.body.fuelCapacityL;
    const engine_type = req.body.engine ?? req.body.engine_type ?? req.body.engineType;
    const registration_no = req.body.registration_no ?? req.body.registrationNo;
    const insurance_expires_at = req.body.insurance_expires_at ?? req.body.insuranceExpiresAt;
    const registration_expires_at =
      req.body.registration_expires_at ?? req.body.registrationExpiresAt;
    const home_marina = req.body.home_marina ?? req.body.homeMarina;
    const photo_url = req.body.photo_url ?? req.body.photoURL;

    if (!name) {
      return res.status(400).json({ error: 'Boat name is required' });
    }

    const result = await db.query(
      `INSERT INTO boats
        (user_id, name, type, boat_type, manufacturer, model, length_m, beam_m, draft_m, fuel_capacity_l, engine_type, engine, registration_no, insurance_expires_at, registration_expires_at, home_marina, country, photo_url, updated_at)
       VALUES
        ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, $13, $14, $15, $16, NOW())
       RETURNING *`,
      [
        req.user.id,
        name,
        type,
        manufacturer ?? null,
        model ?? null,
        length_m ?? null,
        beam_m ?? null,
        draft_m ?? null,
        fuel_capacity_l ?? null,
        engine_type ?? null,
        registration_no ?? null,
        insurance_expires_at ?? null,
        registration_expires_at ?? null,
        home_marina ?? null,
        country ?? null,
        photo_url ?? null,
      ]
    );
    await db.query(
      `INSERT INTO boat_events (boat_id, type, title, description)
       VALUES ($1, 'boat_created', 'Boat profile created', $2)`,
      [result.rows[0].id, name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const name = req.body.name;
    const type = req.body.boat_type ?? req.body.boatType ?? req.body.type;
    const { manufacturer, model, country } = req.body;
    const length_m = req.body.length_m ?? req.body.lengthM;
    const beam_m = req.body.beam_m ?? req.body.beamM;
    const draft_m = req.body.draft_m ?? req.body.draftM;
    const fuel_capacity_l = req.body.fuel_capacity_l ?? req.body.fuelCapacityL;
    const engine_type = req.body.engine ?? req.body.engine_type ?? req.body.engineType;
    const registration_no = req.body.registration_no ?? req.body.registrationNo;
    const insurance_expires_at = req.body.insurance_expires_at ?? req.body.insuranceExpiresAt;
    const registration_expires_at =
      req.body.registration_expires_at ?? req.body.registrationExpiresAt;
    const home_marina = req.body.home_marina ?? req.body.homeMarina;
    const photo_url = req.body.photo_url ?? req.body.photoURL;

    const result = await db.query(
      `UPDATE boats
       SET
         name = COALESCE($1, name),
         type = COALESCE($2, type),
         boat_type = COALESCE($2, boat_type),
         manufacturer = COALESCE($3, manufacturer),
         model = COALESCE($4, model),
         length_m = COALESCE($5, length_m),
         beam_m = COALESCE($6, beam_m),
         draft_m = COALESCE($7, draft_m),
         fuel_capacity_l = COALESCE($8, fuel_capacity_l),
         engine_type = COALESCE($9, engine_type),
         engine = COALESCE($9, engine),
         registration_no = COALESCE($10, registration_no),
         insurance_expires_at = COALESCE($11, insurance_expires_at),
         registration_expires_at = COALESCE($12, registration_expires_at),
         home_marina = COALESCE($13, home_marina),
         country = COALESCE($14, country),
         photo_url = COALESCE($15, photo_url),
         updated_at = NOW()
       WHERE id = $16 AND user_id = $17
       RETURNING *`,
      [
        name ?? null,
        type ?? null,
        manufacturer ?? null,
        model ?? null,
        length_m ?? null,
        beam_m ?? null,
        draft_m ?? null,
        fuel_capacity_l ?? null,
        engine_type ?? null,
        registration_no ?? null,
        insurance_expires_at ?? null,
        registration_expires_at ?? null,
        home_marina ?? null,
        country ?? null,
        photo_url ?? null,
        req.params.id,
        req.user.id,
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Boat not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM boats WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Boat not found' });
    }

    res.json({ message: 'Boat deleted' });
  } catch (err) {
    next(err);
  }
};
