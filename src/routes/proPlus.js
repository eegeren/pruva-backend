const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/proPlusController');

router.use(auth);

router.post('/routes/analyze', ctrl.analyzeRouteRisk);
router.post('/routes/recommend', ctrl.recommendRoutes);
router.get('/anchorages/:anchorageId/intelligence', ctrl.getAnchorageIntelligence);

router.get('/fuel-profile', ctrl.getFuelProfile);
router.put('/fuel-profile', ctrl.upsertFuelProfile);
router.post('/cost-estimates', ctrl.estimateCost);

router.get('/alerts/rules', ctrl.listAlertRules);
router.post('/alerts/rules', ctrl.createAlertRule);
router.get('/alerts/events', ctrl.listAlertEvents);

router.get('/logbook/private', ctrl.listLogbookEntries);
router.post('/logbook/private', ctrl.createLogbookEntry);

router.get('/sync/delta', ctrl.getDeltaSync);
router.post('/sync/ack', ctrl.ackDeltaSync);

module.exports = router;
