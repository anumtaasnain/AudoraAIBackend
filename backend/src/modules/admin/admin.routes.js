const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

// Apply authentication and admin authorization to all admin routes
router.use(protect);
router.use(authorize('admin'));

// Assign leads endpoint
router.post('/assign-leads', adminController.assignLeadsHandler);

// Preview assignments
router.get('/assign-leads/preview', adminController.previewAssignments);

module.exports = router;
