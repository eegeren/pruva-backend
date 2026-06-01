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

exports.create = async (req, res, next) => {
  try {
    const { name, type } = req.body;
    const length_m = req.body.length_m ?? req.body.lengthM;
    const draft_m = req.body.draft_m ?? req.body.draftM;
    const fuel_capacity_l = req.body.fuel_capacity_l ?? req.body.fuelCapacityL;
    const engine_type = req.body.engine_type ?? req.body.engineType;
    const registration_no = req.body.registration_no ?? req.body.registrationNo;
    const insurance_expires_at = req.body.insurance_expires_at ?? req.body.insuranceExpiresAt;
    const registration_expires_at =
      req.body.registration_expires_at ?? req.body.registrationExpiresAt;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }

    const result = await db.query(
      `INSERT INTO boats
        (user_id, name, type, length_m, draft_m, fuel_capacity_l, engine_type, registration_no, insurance_expires_at, registration_expires_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id,
        name,
        type,
        length_m ?? null,
        draft_m ?? null,
        fuel_capacity_l ?? null,
        engine_type ?? null,
        registration_no ?? null,
        insurance_expires_at ?? null,
        registration_expires_at ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name, type } = req.body;
    const length_m = req.body.length_m ?? req.body.lengthM;
    const draft_m = req.body.draft_m ?? req.body.draftM;
    const fuel_capacity_l = req.body.fuel_capacity_l ?? req.body.fuelCapacityL;
    const engine_type = req.body.engine_type ?? req.body.engineType;
    const registration_no = req.body.registration_no ?? req.body.registrationNo;
    const insurance_expires_at = req.body.insurance_expires_at ?? req.body.insuranceExpiresAt;
    const registration_expires_at =
      req.body.registration_expires_at ?? req.body.registrationExpiresAt;

    const result = await db.query(
      `UPDATE boats
       SET
         name = COALESCE($1, name),
         type = COALESCE($2, type),
         length_m = COALESCE($3, length_m),
         draft_m = COALESCE($4, draft_m),
         fuel_capacity_l = COALESCE($5, fuel_capacity_l),
         engine_type = COALESCE($6, engine_type),
         registration_no = COALESCE($7, registration_no),
         insurance_expires_at = COALESCE($8, insurance_expires_at),
         registration_expires_at = COALESCE($9, registration_expires_at)
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [
        name ?? null,
        type ?? null,
        length_m ?? null,
        draft_m ?? null,
        fuel_capacity_l ?? null,
        engine_type ?? null,
        registration_no ?? null,
        insurance_expires_at ?? null,
        registration_expires_at ?? null,
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
