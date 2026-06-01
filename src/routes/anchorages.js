const router = require('express').Router();
const ctrl = require('../controllers/anchorageController');

router.get('/bounds', ctrl.getByBounds);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);

module.exports = router;
router.get('/search', require('../controllers/anchorageController').search);
