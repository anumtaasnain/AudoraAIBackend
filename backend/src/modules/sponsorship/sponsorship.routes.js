const express = require('express');
const router = express.Router();
const controller = require('./sponsorship.controller');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

router.use(protect);

router.post('/request', authorize('organizer'), controller.createSponsorshipRequest);
router.get('/my-requests', authorize('organizer', 'sponsor'), controller.getSponsorshipRequests);
router.patch('/:id/status', authorize('sponsor'), controller.updateSponsorshipStatus);
router.get('/:id/messages', controller.getMessages);
router.post('/:id/messages', controller.sendMessage);
router.post('/enhance-pitch', authorize('organizer'), controller.enhancePitch);

module.exports = router;
