const router = require('express').Router();
const ctrl = require('../controllers/weatherController');

router.get('/', ctrl.getMarine);

module.exports = router;
