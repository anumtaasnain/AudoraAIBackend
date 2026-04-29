const express    = require('express');
const router     = express.Router();
const controller = require('./dashboard.controller');
const { protect }   = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

router.use(protect);
router.use(authorize('organizer', 'sponsor', 'admin'));

router.get('/summary',          controller.getSummary);
router.get('/activity',         controller.getActivity);
router.get('/engagement-trend', controller.getEngagementTrend);

module.exports = router;
