const router = require('express').Router();
const auth = require('../middleware/auth');
const boatCtrl = require('../controllers/boatController');
const fuelCtrl = require('../controllers/fuelController');
const mooringCtrl = require('../controllers/mooringController');
const maintenanceCtrl = require('../controllers/maintenanceController');
const voyageCtrl = require('../controllers/voyageController');
const photoCtrl = require('../controllers/boatPhotoController');
const documentCtrl = require('../controllers/boatDocumentController');
const eventCtrl = require('../controllers/boatEventController');

// All boat routes require authentication
router.use(auth);

// Boats
router.get('/', boatCtrl.getAll);
router.post('/', boatCtrl.create);
router.get('/:id', boatCtrl.getOne);
router.put('/:id', boatCtrl.update);
router.delete('/:id', boatCtrl.delete);

// Photos
router.get('/:boatId/photos', photoCtrl.getAll);
router.post('/:boatId/photos', photoCtrl.create);
router.delete('/:boatId/photos/:photoId', photoCtrl.delete);

// Documents
router.get('/:boatId/documents', documentCtrl.getAll);
router.post('/:boatId/documents', documentCtrl.create);
router.put('/:boatId/documents/:documentId', documentCtrl.update);
router.delete('/:boatId/documents/:documentId', documentCtrl.delete);

// Fuel
router.get('/:boatId/fuel', fuelCtrl.getAll);
router.get('/:boatId/fuel/stats', fuelCtrl.getStats);
router.post('/:boatId/fuel', fuelCtrl.create);
router.get('/:boatId/fuel-logs', fuelCtrl.getAll);
router.post('/:boatId/fuel-logs', fuelCtrl.create);
router.delete('/:boatId/fuel-logs/:fuelLogId', fuelCtrl.delete);

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
router.put('/:boatId/maintenance/:maintenanceId', maintenanceCtrl.update);
router.delete('/:boatId/maintenance/:maintenanceId', maintenanceCtrl.delete);

// Voyages
router.get('/:boatId/voyages', voyageCtrl.getAll);
router.get('/:boatId/voyages/stats', voyageCtrl.getStats);
router.post('/:boatId/voyages', voyageCtrl.create);
router.put('/:boatId/voyages/:voyageId', voyageCtrl.update);
router.delete('/:boatId/voyages/:voyageId', voyageCtrl.delete);

// Events
router.get('/:boatId/events', eventCtrl.getAll);

module.exports = router;
