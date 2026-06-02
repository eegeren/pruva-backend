const router = require('express').Router();
const auth = require('../middleware/auth');
const storage = require('../services/storageService');

router.use(auth);

router.post('/boat-photo', async (req, res, next) => {
  try {
    const result = await storage.uploadImage({
      fileUrl: req.body.file_url ?? req.body.fileUrl,
      mimeType: req.body.mime_type ?? req.body.mimeType,
      sizeBytes: req.body.size_bytes ?? req.body.sizeBytes,
    });
    res.status(201).json({ file_url: result.fileUrl, storage_configured: storage.isConfigured() });
  } catch (err) {
    next(err);
  }
});

router.post('/boat-document', async (req, res, next) => {
  try {
    const result = await storage.uploadDocument({
      fileUrl: req.body.file_url ?? req.body.fileUrl,
      mimeType: req.body.mime_type ?? req.body.mimeType,
      sizeBytes: req.body.size_bytes ?? req.body.sizeBytes,
    });
    res.status(201).json({ file_url: result.fileUrl, storage_configured: storage.isConfigured() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
