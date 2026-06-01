const router = require('express').Router({ mergeParams: true });
const ctrl = require('../controllers/commentController');
const auth = require('../middleware/auth');

router.get('/:id/comments', ctrl.getByAnchorage);
router.post('/:id/comments', auth, ctrl.create);

module.exports = router;
