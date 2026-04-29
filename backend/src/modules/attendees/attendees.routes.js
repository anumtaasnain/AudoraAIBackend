const express    = require('express');
const router     = express.Router();
const controller = require('./attendees.controller');
const { protect }   = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

router.use(protect);

router.get('/',     authorize('organizer', 'admin', 'sponsor'), controller.getAttendees);
router.get('/:id',  controller.getAttendee);
router.get('/:id/score', controller.getAttendeeScore);

module.exports = router;
