const express    = require('express');
const router     = express.Router();
const controller = require('./users.controller');
const { protect }   = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

router.use(protect);

router.get('/me',     controller.getMe);
router.patch('/me',   controller.updateMe);
router.delete('/me',  controller.deleteMe);
router.get('/sponsors', controller.getSponsors);

// Admin only
router.get('/',    authorize('admin'), controller.getAllUsers);
router.get('/:id', authorize('admin'), controller.getUser);

module.exports = router;
