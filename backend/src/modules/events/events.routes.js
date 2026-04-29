const express    = require('express');
const router     = express.Router();
const controller = require('./events.controller');
const { protect }   = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

router.get('/public', controller.getPublicEvents);

router.use(protect);

router.get('/',     controller.getEvents);
router.get('/registrations', controller.getRegistrations);
router.patch('/registrations/:id/status', authorize('admin', 'organizer'), controller.updateRegistrationStatus);
router.patch('/registrations/:id/attendance', authorize('admin', 'organizer'), controller.updateRegistrationAttendance);

router.get('/:id',  controller.getEvent);
router.post('/',    authorize('organizer', 'admin'), controller.createEvent);
router.patch('/:id',  authorize('organizer', 'admin'), controller.updateEvent);
router.patch('/:id/status', authorize('admin', 'sponsor'), controller.updateEventStatus);
router.delete('/:id', authorize('organizer', 'admin'), controller.deleteEvent);
router.post('/:id/register', authorize('attendee'), controller.registerForEvent);

module.exports = router;
