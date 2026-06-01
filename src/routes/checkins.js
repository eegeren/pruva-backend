const router = require('express').Router({ mergeParams: true });
const ctrl = require('../controllers/checkinController');
const auth = require('../middleware/auth');

router.get('/:id/checkins', ctrl.getAll);
router.post('/:id/checkins', auth, ctrl.create);
router.put('/:id/checkins/:cid', auth, ctrl.checkout);
router.get('/:id/checkins/current', ctrl.getCurrent);

module.exports = router;
