const express    = require('express');
const router     = express.Router();
const controller = require('./sponsors.controller');
const { protect }   = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

router.use(protect);
router.use(authorize('sponsor', 'admin'));

router.get('/leads',              controller.getLeads);
router.get('/leads/:id',          controller.getLead);
router.patch('/leads/:id/status', controller.updateLeadStatus);
router.get('/metrics',            controller.getMetrics);
router.get('/conversion-trend',   controller.getConversionTrend);
router.get('/lead-quality',       controller.getLeadQuality);
router.post('/generate-leads',    controller.generateLeads);

module.exports = router;
