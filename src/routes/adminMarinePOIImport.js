const router = require('express').Router();
const ctrl = require('../controllers/marinePOIController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

router.post('/region', auth, adminAuth, ctrl.importRegion);
router.post('/bbox', auth, adminAuth, ctrl.importBoundingBox);

module.exports = router;

