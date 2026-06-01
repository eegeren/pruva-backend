const router = require('express').Router();
const ctrl = require('../controllers/mapPointController');
const auth = require('../middleware/auth');

router.get('/bounds', ctrl.getByBounds);
router.get('/:id', ctrl.getById);
router.post('/', auth, ctrl.create);
router.post('/:id/rate', auth, ctrl.rate);

module.exports = router;
