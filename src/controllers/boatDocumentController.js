const db = require('../config/db');
const { verifyBoatOwnership } = require('./boatOwnership');
const storage = require('../services/storageService');
const { createBoatEvent } = require('./boatEventController');

const allowedTypes = new Set(['insurance', 'registration', 'survey', 'mooring_contract', 'license', 'other']);

function normalizeType(type) {
  return String(type || '').trim().toLowerCase();
}

exports.getAll = async (req, res, next) => {
  try {
    const { boatId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      'SELECT * FROM boat_documents WHERE boat_id = $1 ORDER BY expiry_date ASC NULLS LAST, created_at DESC',
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

    const type = normalizeType(req.body.type);
    const title = String(req.body.title || '').trim();
    if (!allowedTypes.has(type)) return res.status(400).json({ error: 'Document type is required' });
    if (!title) return res.status(400).json({ error: 'Document title is required' });

    const file_url = req.body.file_url ?? req.body.fileUrl;
    const uploaded = await storage.uploadDocument({
      fileUrl: file_url,
      mimeType: req.body.mime_type ?? req.body.mimeType,
      sizeBytes: req.body.size_bytes ?? req.body.sizeBytes,
    });

    const result = await db.query(
      `INSERT INTO boat_documents (boat_id, type, title, file_url, expiry_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        boatId,
        type,
        title,
        uploaded.fileUrl,
        req.body.expiry_date ?? req.body.expiryDate ?? null,
        req.body.notes ?? null,
      ]
    );
    await createBoatEvent(boatId, 'document_added', 'Document added', title, { document_id: result.rows[0].id, type });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { boatId, documentId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const type = req.body.type == null ? null : normalizeType(req.body.type);
    if (type && !allowedTypes.has(type)) return res.status(400).json({ error: 'Document type is invalid' });

    const result = await db.query(
      `UPDATE boat_documents
       SET type = COALESCE($1, type),
           title = COALESCE($2, title),
           file_url = COALESCE($3, file_url),
           expiry_date = COALESCE($4, expiry_date),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $6 AND boat_id = $7
       RETURNING *`,
      [
        type,
        req.body.title ?? null,
        req.body.file_url ?? req.body.fileUrl ?? null,
        req.body.expiry_date ?? req.body.expiryDate ?? null,
        req.body.notes ?? null,
        documentId,
        boatId,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { boatId, documentId } = req.params;
    await verifyBoatOwnership(boatId, req.user.id);
    const result = await db.query(
      'DELETE FROM boat_documents WHERE id = $1 AND boat_id = $2 RETURNING file_url',
      [documentId, boatId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    await storage.deleteFile(result.rows[0].file_url);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
};
