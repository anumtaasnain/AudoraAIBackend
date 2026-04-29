const express = require('express');
const router = express.Router();
const controller = require('./audience.controller');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

router.use(protect);

router.post('/request', authorize('organizer'), controller.createAudienceRequest);
router.post('/confirm', authorize('organizer'), controller.confirmAudienceRequest); // Simplified confirmation endpoint

module.exports = router;
