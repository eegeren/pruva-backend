const db = require('../config/db');

async function verifyBoatOwnership(boatId, userId) {
  const result = await db.query(
    'SELECT id FROM boats WHERE id = $1 AND user_id = $2',
    [boatId, userId]
  );

  if (!result.rows[0]) {
    throw { status: 403, message: 'You do not have permission to access this boat' };
  }
}

module.exports = { verifyBoatOwnership };
