const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');
const storage = require('../services/storageService');
const { createBoatEvent } = require('./boatEventController');

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      'SELECT * FROM boat_photos WHERE boat_id = $1 ORDER BY created_at DESC',
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
    const file_url = req.body.file_url ?? req.body.image_url ?? req.body.fileUrl ?? req.body.imageUrl;
    const caption = req.body.caption ?? null;
    const uploaded = await storage.uploadImage({
      fileUrl: file_url,
      fileData: req.body.file_data ?? req.body.fileData,
      mimeType: req.body.mime_type ?? req.body.mimeType,
      sizeBytes: req.body.size_bytes ?? req.body.sizeBytes,
      caption,
    });
    const result = await db.query(
      `INSERT INTO boat_photos (boat_id, image_url, caption)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [boatId, uploaded.fileUrl, caption]
    );
    await db.query('UPDATE boats SET photo_url = COALESCE(photo_url, $1), updated_at = NOW() WHERE id = $2', [
      uploaded.fileUrl,
      boatId,
    ]);
    await createBoatEvent(boatId, 'photo_added', 'Photo added', caption, { photo_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { boatId, photoId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      'DELETE FROM boat_photos WHERE id = $1 AND boat_id = $2 RETURNING image_url',
      [photoId, boatId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Photo not found' });
    await storage.deleteFile(result.rows[0].image_url);
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    next(err);
  }
};
