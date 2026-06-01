const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      'SELECT * FROM moorings WHERE boat_id = $1 ORDER BY created_at DESC',
      [boatId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getCurrent = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const result = await db.query(
      'SELECT * FROM moorings WHERE boat_id = $1 AND is_current = true ORDER BY created_at DESC LIMIT 1',
      [boatId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Current mooring not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  const client = await db.connect();

  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const name = req.body.name;
    const type = req.body.type;
    const notes = req.body.notes;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const is_current = req.body.is_current ?? req.body.isCurrent;
    const arrived_at = req.body.arrived_at ?? req.body.arrivedAt;
    const departed_at = req.body.departed_at ?? req.body.departedAt;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    await client.query('BEGIN');

    if (is_current === true) {
      await client.query('UPDATE moorings SET is_current = false WHERE boat_id = $1', [boatId]);
    }

    const result = await client.query(
      `INSERT INTO moorings
        (boat_id, name, type, notes, latitude, longitude, is_current, arrived_at, departed_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, COALESCE($7, false), $8, $9)
       RETURNING *`,
      [
        boatId,
        name,
        type ?? null,
        notes ?? null,
        latitude ?? null,
        longitude ?? null,
        is_current ?? false,
        arrived_at ?? null,
        departed_at ?? null,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.update = async (req, res, next) => {
  const client = await db.connect();

  try {
    const { boatId, id } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);

    const exists = await client.query(
      'SELECT id FROM moorings WHERE id = $1 AND boat_id = $2',
      [id, boatId]
    );
    if (!exists.rows[0]) {
      return res.status(404).json({ error: 'Mooring not found' });
    }

    const name = req.body.name;
    const type = req.body.type;
    const notes = req.body.notes;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const is_current = req.body.is_current ?? req.body.isCurrent;
    const arrived_at = req.body.arrived_at ?? req.body.arrivedAt;
    const departed_at = req.body.departed_at ?? req.body.departedAt;

    await client.query('BEGIN');

    if (is_current === true) {
      await client.query(
        'UPDATE moorings SET is_current = false WHERE boat_id = $1 AND id <> $2',
        [boatId, id]
      );
    }

    const result = await client.query(
      `UPDATE moorings
       SET
         name = COALESCE($1, name),
         type = COALESCE($2, type),
         notes = COALESCE($3, notes),
         latitude = COALESCE($4, latitude),
         longitude = COALESCE($5, longitude),
         is_current = COALESCE($6, is_current),
         arrived_at = COALESCE($7, arrived_at),
         departed_at = COALESCE($8, departed_at)
       WHERE id = $9 AND boat_id = $10
       RETURNING *`,
      [
        name ?? null,
        type ?? null,
        notes ?? null,
        latitude ?? null,
        longitude ?? null,
        is_current ?? null,
        arrived_at ?? null,
        departed_at ?? null,
        id,
        boatId,
      ]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};
