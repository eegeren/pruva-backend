const router = require('express').Router();
const ctrl = require('../controllers/marinePOIController');
const adminAuth = require('../middleware/adminAuth');

router.post('/region', adminAuth, ctrl.importRegion);
router.post('/bbox', adminAuth, ctrl.importBoundingBox);

module.exports = router;
