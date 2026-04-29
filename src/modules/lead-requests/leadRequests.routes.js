const express = require('express');
const router = express.Router();
const leadRequestController = require('./leadRequests.controller');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

// All routes require authentication
router.use(protect);

// Organizer routes
router.post('/', authorize('organizer'), leadRequestController.createLeadRequest);
router.get('/my', authorize('organizer'), leadRequestController.getMyLeadRequests);
router.get('/:id/assigned-leads', authorize('organizer'), leadRequestController.getAssignedLeads);

// Admin routes
router.get('/all', authorize('admin'), leadRequestController.getAllLeadRequests);
router.post('/:id/assign', authorize('admin'), leadRequestController.assignLeadsToRequest);
router.post('/:id/confirm', leadRequestController.confirmLeadRequest);

module.exports = router;
