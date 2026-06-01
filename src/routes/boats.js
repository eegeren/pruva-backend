const router = require('express').Router();
const auth = require('../middleware/auth');
const boatCtrl = require('../controllers/boatController');
const fuelCtrl = require('../controllers/fuelController');
const mooringCtrl = require('../controllers/mooringController');
const maintenanceCtrl = require('../controllers/maintenanceController');
const voyageCtrl = require('../controllers/voyageController');

// All boat routes require authentication
router.use(auth);

// Boats
router.get('/', boatCtrl.getAll);
router.post('/', boatCtrl.create);
router.put('/:id', boatCtrl.update);
router.delete('/:id', boatCtrl.delete);

// Fuel
router.get('/:boatId/fuel', fuelCtrl.getAll);
router.get('/:boatId/fuel/stats', fuelCtrl.getStats);
router.post('/:boatId/fuel', fuelCtrl.create);

// Moorings
router.get('/:boatId/moorings', mooringCtrl.getAll);
router.get('/:boatId/moorings/current', mooringCtrl.getCurrent);
router.post('/:boatId/moorings', mooringCtrl.create);
router.put('/:boatId/moorings/:id', mooringCtrl.update);

// Maintenance
router.get('/:boatId/maintenance', maintenanceCtrl.getAll);
router.get('/:boatId/maintenance/upcoming', maintenanceCtrl.getUpcoming);
router.get('/:boatId/maintenance/stats', maintenanceCtrl.getStats);
router.post('/:boatId/maintenance', maintenanceCtrl.create);

// Voyages
router.get('/:boatId/voyages', voyageCtrl.getAll);
router.get('/:boatId/voyages/stats', voyageCtrl.getStats);
router.post('/:boatId/voyages', voyageCtrl.create);

module.exports = router;
