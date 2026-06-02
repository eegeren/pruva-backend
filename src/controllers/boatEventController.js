const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');

async function createBoatEvent(boatId, type, title, description = null, metadata = {}) {
  await db.query(
    `INSERT INTO boat_events (boat_id, type, title, description, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [boatId, type, title, description, metadata]
  );
}

exports.createBoatEvent = createBoatEvent;

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      'SELECT * FROM boat_events WHERE boat_id = $1 ORDER BY event_date DESC, created_at DESC',
      [boatId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
