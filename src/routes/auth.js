const router = require('express').Router();
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/profile', auth, require('../controllers/authController').getProfile);
router.put('/profile', auth, require('../controllers/authController').updateProfile);
router.delete('/account', auth, ctrl.deleteAccount);

module.exports = router;
