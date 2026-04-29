const express    = require('express');
const router     = express.Router();
const controller = require('./analytics.controller');
const { protect }   = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

router.use(protect);
router.use(authorize('organizer', 'sponsor', 'admin'));

router.get('/overview',               controller.getOverview);
router.get('/engagement-by-industry', controller.getEngagementByIndustry);
router.get('/segmentation',           controller.getSegmentation);
router.get('/roi-trend',              controller.getRoiTrend);
router.get('/funnel',                 controller.getFunnel);
router.get('/engagement-trend',       controller.getEngagementTrend);

module.exports = router;
