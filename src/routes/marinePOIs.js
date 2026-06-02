const router = require('express').Router();
const ctrl = require('../controllers/marinePOIController');

router.get('/', ctrl.getByBounds);
router.get('/nearby', ctrl.nearby);
router.get('/search', ctrl.search);
router.get('/:id', ctrl.getById);

module.exports = router;
